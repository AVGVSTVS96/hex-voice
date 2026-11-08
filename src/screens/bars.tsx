import { Stack, type NativeStackHeaderItem, type NativeStackHeaderItemButton } from 'expo-router';
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { buttonsOf, type Call, type CallButton } from '@/call/call';
import { PRIMARY } from '@/components/call-controls';
import type { Back } from '@/components/tasks/bar';
import { SYMBOLS } from '@/ui/glass-button';
import { theme } from '@/theme';

type Toggle = { open: boolean; onPress: () => void };

// The screen's bars are iOS's own, so iOS places them in the frame a turn, fold or Split View
// lands: across the top, or down iPhone Duo's side under the status items where the system puts its
// bars there, clear of the camera, with the call's buttons at the bar's foot. Back, then Calls,
// lead; Tasks and settings trail. Each item has a symbol and a title, which is what lets iOS stand it
// in a bar down the side or fold it into the bar's overflow.
//
// iOS sets a bar's items again whenever they change, so they're made only when what they show
// does: each press reaches the newest handler through `press`, never a new function.
export function Bars(props: Props) {
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const press = useCallback((what: Pressable) => () => pressOf(latest.current, what)(), []);
  const { back, calls, tasks, settings, call, beside } = props;
  return (
    <Items
      back={back?.to}
      calls={calls.open}
      tasks={tasks.open}
      needs={tasks.open ? 0 : tasks.needs}
      working={tasks.working}
      settings={settings.open}
      call={call && buttonsOf(call.call).call}
      muted={call && buttonsOf(call.call).mute?.muted}
      mutes={!!call && !!buttonsOf(call.call).mute?.enabled}
      ready={!!call?.ready}
      beside={beside && (beside.stacks ? 'column' : 'row')}
      besideOn={!!beside?.open}
      press={press}
    />
  );
}

type Props = {
  back?: Back;
  calls: Toggle;
  tasks: Toggle & { needs: number; working: number };
  settings: Toggle;
  // The call's buttons, where they sit in the bar.
  call?: { call: Call; ready: boolean; onMute: () => void; onPrimary: () => void };
  // The switch that gives the call's words the page before the fold, beside Tasks.
  beside?: Toggle & { stacks: boolean };
};
type Pressable = 'back' | 'calls' | 'tasks' | 'settings' | 'mute' | 'primary' | 'beside';

function pressOf(props: Props, what: Pressable): () => void {
  const none = () => {};
  switch (what) {
    case 'back':
      return props.back?.onPress ?? none;
    case 'mute':
      return props.call?.onMute ?? none;
    case 'primary':
      return props.call?.onPrimary ?? none;
    case 'beside':
      return props.beside?.onPress ?? none;
    case 'calls':
    case 'tasks':
    case 'settings':
      return props[what].onPress;
  }
}

const Items = memo(function Items({
  back,
  calls,
  tasks,
  needs,
  working,
  settings,
  call,
  muted,
  mutes,
  ready,
  beside,
  besideOn,
  press,
}: {
  back?: string;
  calls: boolean;
  tasks: boolean;
  needs: number;
  working: number;
  settings: boolean;
  call?: CallButton;
  // Mute shows on a call, `muted` or not, and works once it's live (`mutes`).
  muted?: boolean;
  mutes: boolean;
  ready: boolean;
  // The words' switch, drawn as the way it lays them beside Tasks, and whether it's on.
  beside?: 'row' | 'column';
  besideOn: boolean;
  press: (what: Pressable) => () => void;
}) {
  const options = useMemo(() => {
    const left: NativeStackHeaderItem[] = [
      ...(back ? [item('back', `Back to ${back}`, SYMBOLS.back, { onPress: press('back') })] : []),
      item('calls-button', 'Calls', SYMBOLS.calls, { selected: calls, onPress: press('calls') }),
    ];
    const right: NativeStackHeaderItem[] = [
      item('tasks-button', 'Tasks', SYMBOLS.tasks, {
        selected: tasks,
        onPress: press('tasks'),
        accessibilityHint: tasksHint(needs, working),
        ...(needs
          ? { badge: { value: needs, style: { backgroundColor: theme.accentSolid } } }
          : {}),
      }),
      item('voice-settings-button', 'Voice and appearance settings', SYMBOLS.settings, {
        selected: settings,
        onPress: press('settings'),
      }),
    ];
    return {
      headerShown: true,
      headerTransparent: true,
      title: '',
      unstable_headerLeftItems: () => left,
      unstable_headerRightItems: () => right,
    };
  }, [back, calls, tasks, needs, working, settings, press]);
  return (
    <>
      <Stack.Screen options={options} />
      {call ? (
        <CallItems
          call={call}
          muted={muted}
          mutes={mutes}
          ready={ready}
          beside={beside}
          besideOn={besideOn}
          press={press}
        />
      ) : null}
    </>
  );
});

// A bar button: its symbol, and its title, which is what VoiceOver says and the bar's overflow
// shows. `identifier` names it for checks.
function item(
  identifier: string,
  label: string,
  symbol: SFSymbol,
  rest: { onPress: () => void } & Partial<NativeStackHeaderItemButton>,
): NativeStackHeaderItemButton {
  return { type: 'button', identifier, label, icon: { type: 'sfSymbol', name: symbol }, ...rest };
}

// Mute and the call button at the bar's foot, after the words' switch while it's offered. With no
// call there's nothing to mute, so mute waits hidden.
function CallItems({
  call,
  muted,
  mutes,
  ready,
  beside,
  besideOn,
  press,
}: {
  call: CallButton;
  // Mute shows on a call, `muted` or not, and works once it's live (`mutes`).
  muted?: boolean;
  mutes: boolean;
  ready: boolean;
  beside?: 'row' | 'column';
  besideOn: boolean;
  press: (what: Pressable) => () => void;
}) {
  const primary = PRIMARY[call];
  return (
    <Stack.Toolbar>
      <Stack.Toolbar.Spacer />
      {beside ? (
        <Stack.Toolbar.Button
          identifier="transcript-beside-button"
          icon={SYMBOLS[`beside-${beside}`]}
          selected={besideOn}
          onPress={press('beside')}
        >
          Transcript beside Tasks
        </Stack.Toolbar.Button>
      ) : null}
      <Stack.Toolbar.Button
        identifier="session-mute-button"
        icon={muted ? SYMBOLS['mic-off'] : SYMBOLS.mic}
        hidden={muted === undefined}
        disabled={!mutes}
        selected={!!muted}
        onPress={press('mute')}
      >
        {muted ? 'Unmute microphone' : 'Mute microphone'}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button
        identifier="session-primary-button"
        icon={SYMBOLS[primary.icon]}
        variant="prominent"
        tintColor={theme.prominent}
        disabled={primary.off || !ready}
        onPress={press('primary')}
      >
        {primary.label}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}

// What needs you and what's working, told to VoiceOver; the badge shows what needs you.
function tasksHint(needs: number, working: number) {
  return [
    needs ? `${needs} need${needs === 1 ? 's' : ''} you` : '',
    working ? `${working} working` : '',
  ]
    .filter(Boolean)
    .join(', ');
}
