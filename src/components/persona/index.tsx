/**
 * Native adaptation of AI Elements Persona. Original assets and source details
 * are listed in assets/README.md, with the upstream license alongside them.
 */
import {
  Fit,
  RiveColor,
  RiveFileFactory,
  RiveView,
  useRive,
  useViewModelInstance,
  type RiveFile,
} from '@rive-app/react-native';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { theme } from '@/theme';
import {
  PERSONA_MODELS,
  PERSONA_STATE_MACHINE,
  personaInputValues,
  type PersonaProps,
} from './animation';
import { PERSONA_ASSETS } from './assets';
import { DEFAULT_PERSONA, DEFAULT_PERSONA_COLOR, type PersonaVariant } from './variants';

export type { PersonaState, PersonaProps } from './animation';

// Cache the six decoded files. Each rendered view keeps its own animation state.
const fileCache = new Map<PersonaVariant, Promise<RiveFile>>();

function loadFile(variant: PersonaVariant) {
  let promise = fileCache.get(variant);
  if (!promise) {
    promise = RiveFileFactory.fromSource(PERSONA_ASSETS[variant], undefined, false).catch(
      (error) => {
        fileCache.delete(variant);
        throw error;
      },
    );
    fileCache.set(variant, promise);
  }
  return promise;
}

function sameColor(a: number, b: number) {
  return [0, 8, 16].every((shift) => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)) <= 1);
}

export function Persona({ variant = DEFAULT_PERSONA, ...props }: PersonaProps) {
  // Give the new file a fresh native view and discard any previous visual error.
  return <PersonaRenderer key={variant} variant={variant} {...props} />;
}

function PersonaRenderer({
  variant,
  state = 'idle',
  size = 320,
  color = DEFAULT_PERSONA_COLOR,
  palette,
}: PersonaProps & { variant: PersonaVariant }) {
  const [file, setFile] = useState<RiveFile>();
  const [failed, setFailed] = useState(false);
  const { riveViewRef, setHybridRef } = useRive();
  const dynamicColor = PERSONA_MODELS[variant].dynamicColor;
  const { instance: colorModel } = useViewModelInstance(dynamicColor ? file : null, {
    async: true,
  });
  const initialized = useRef(false);
  const originalPalette = useRef<number>(undefined);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    void loadFile(variant)
      .then((loaded) => {
        if (active) setFile(loaded);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [variant]);

  useEffect(() => {
    if (!riveViewRef) return;
    if (dynamicColor && !colorModel) return;
    let cancelled = false;
    let frame = 0;
    const pause = () => {
      if (cancelled) return;
      void riveViewRef.pause().catch(() => {
        if (!cancelled) setFailed(true);
      });
    };

    try {
      if (reducedMotion && initialized.current) {
        // Input setters resume playback. Keep reduced-motion visuals frozen.
        pause();
      } else {
        for (const { name, value } of personaInputValues(state)) {
          riveViewRef.setBooleanInputValue(name, value);
        }
        if (variant === 'opal') {
          originalPalette.current ??= riveViewRef.getNumberInputValue('color');
          riveViewRef.setNumberInputValue('color', palette ?? originalPalette.current);
        }
        riveViewRef.playIfNeeded();
        initialized.current = true;
        if (reducedMotion) {
          // Draw the first frame before pausing so the new visual is visible.
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(pause);
          });
        }
      }
    } catch {
      setFailed(true);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [riveViewRef, state, variant, palette, dynamicColor, colorModel, reducedMotion]);

  useEffect(() => {
    const property = riveViewRef ? colorModel?.colorProperty('color') : undefined;
    if (!property) return;
    const wanted = RiveColor.fromHexString(color).toInt();
    property.set(wanted);
    // The first advance after binding writes the file's own color back into the model.
    return property.addListener((value) => {
      if (!sameColor(value, wanted)) property.set(wanted);
    });
  }, [riveViewRef, colorModel, color]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {file && !failed && (!dynamicColor || colorModel) ? (
        <RiveView
          hybridRef={setHybridRef}
          file={file}
          stateMachineName={PERSONA_STATE_MACHINE}
          dataBind={colorModel ?? undefined}
          fit={Fit.Contain}
          autoPlay
          onError={() => setFailed(true)}
          style={{ width: size, height: size, backgroundColor: 'transparent' }}
        />
      ) : (
        <View
          style={{
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: size,
            borderWidth: 1,
            borderColor: theme.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {failed && (
            <Text style={{ color: theme.secondary, fontSize: 12 }}>Visual unavailable</Text>
          )}
        </View>
      )}
    </View>
  );
}
