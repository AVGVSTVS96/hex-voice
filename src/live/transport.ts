import { mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import * as z from 'zod/mini';

import { parseEvent } from './types';
import type { AudioStats, TransportFactory } from './types';

const androidCallManager = process.env.EXPO_OS === 'android' ? InCallManager : null;

const loose = <T extends z.core.SomeType>(schema: T) => z.catch(z.optional(schema), undefined);

const Report = z.object({
  id: z.catch(z.string(), ''),
  type: z.catch(z.string(), ''),
  kind: loose(z.string()),
  mediaType: loose(z.string()),
  audioLevel: loose(z.number()),
  totalAudioEnergy: loose(z.number()),
  totalSamplesDuration: loose(z.number()),
  packetsReceived: loose(z.number()),
  packetsSent: loose(z.number()),
});

const Reports = z.map(z.unknown(), Report);

const Description = z.object({ sdp: z.string(), type: z.nullable(z.string()) });

export const createTransport: TransportFactory = async ({ onEvent, onFailure }) => {
  const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
  let peer: RTCPeerConnection | undefined;
  let channel: ReturnType<RTCPeerConnection['createDataChannel']>;

  try {
    peer = new RTCPeerConnection({ iceServers: [] });
    // 'video' routes to the speaker, not the earpiece: https://github.com/react-native-webrtc/react-native-incall-manager#readme
    androidCallManager?.start({ media: 'video', auto: true });

    for (const track of stream.getAudioTracks()) {
      peer.addTrack(track, stream);
    }

    channel = peer.createDataChannel('oai-events', { ordered: true });
  } catch (error) {
    for (const track of stream.getTracks()) {
      track.stop();
    }

    peer?.close();
    stream.release();
    androidCallManager?.stop();
    throw error;
  }

  const pc = peer;
  let closed = false;
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const energies = new Map<string, { energy: number; duration: number }>();
  // oxlint-disable-next-line unicorn/prefer-add-event-listener, anti-slop/no-unknown-parameters -- react-native-webrtc's typings leave out its event-target-shim, so addEventListener and the message's type don't exist to TypeScript; parseEvent parses it
  channel.onmessage = (message: unknown) => {
    const event = closed ? undefined : parseEvent(message);

    if (event) {
      onEvent(event);
    }
  };

  // oxlint-disable-next-line unicorn/prefer-add-event-listener -- react-native-webrtc's typings leave out its event-target-shim, so addEventListener doesn't exist to TypeScript
  channel.onclose = () => {
    if (!closed) {
      onFailure('The voice connection closed. Start a new conversation to reconnect.');
    }
  };

  pc.onconnectionstatechange = () => {
    clearTimeout(disconnectTimer);

    if (closed) {
      return;
    }

    if (pc.connectionState === 'failed') {
      onFailure('The audio connection failed. Check your connection and try again.');
    }

    if (pc.connectionState === 'disconnected') {
      disconnectTimer = setTimeout(() => {
        onFailure('The audio connection was lost. Try starting again.');
      }, 7000);
    }
  };

  return {
    async offer() {
      const offer = Description.parse(
        await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false }),
      );

      await pc.setLocalDescription(offer);

      if (pc.iceGatheringState !== 'complete') {
        // oxlint-disable-next-line promise/avoid-new -- ICE gathering reports only by event, so its end is a promise made here
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(
              new Error('Could not establish an audio route. Check your network and try again.'),
            );
          }, 10_000);

          const check = () => {
            if (pc.iceGatheringState === 'complete') {
              cleanup();
              resolve();
            }
          };

          const cleanup = () => {
            clearTimeout(timeout);
            pc.onicegatheringstatechange = null;
          };

          pc.onicegatheringstatechange = check;
          check();
        });
      }

      const sdp = pc.localDescription?.sdp;

      if (sdp === undefined || sdp === '') {
        throw new Error('Could not prepare the audio connection.');
      }

      return sdp;
    },
    answer: async (sdp) => {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    },
    send(event) {
      if (closed || channel.readyState !== 'open') {
        return false;
      }

      try {
        channel.send(JSON.stringify(event));

        return true;
      } catch {
        return false;
      }
    },
    setMuted(muted) {
      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
      }
    },
    async stats() {
      const result: AudioStats = {
        inputLevel: 0,
        outputLevel: 0,
        sentPackets: 0,
        receivedPackets: 0,
      };

      if (closed) {
        return result;
      }

      const reports = Reports.parse(await pc.getStats());

      for (const report of reports.values()) {
        if (report.kind !== 'audio' && report.mediaType !== 'audio') {
          continue;
        }

        const { audioLevel, totalAudioEnergy: energy, totalSamplesDuration: duration } = report;
        let level = audioLevel ?? 0;

        if (energy !== undefined && duration !== undefined) {
          const previous = energies.get(report.id);

          if (previous && duration > previous.duration && audioLevel === undefined) {
            level = Math.sqrt(
              Math.max(0, (energy - previous.energy) / (duration - previous.duration)),
            );
          }

          energies.set(report.id, { energy, duration });
        }

        if (report.type === 'media-source') {
          result.inputLevel = Math.max(result.inputLevel, level);
        }

        if (report.type === 'inbound-rtp') {
          result.outputLevel = Math.max(result.outputLevel, level);
          result.receivedPackets += report.packetsReceived ?? 0;
        }

        if (report.type === 'outbound-rtp') {
          result.sentPackets += report.packetsSent ?? 0;
        }
      }

      return result;
    },
    close() {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(disconnectTimer);

      for (const track of stream.getTracks()) {
        track.stop();
      }

      channel.close();
      pc.close();
      stream.release();
      androidCallManager?.stop();
    },
  };
};
