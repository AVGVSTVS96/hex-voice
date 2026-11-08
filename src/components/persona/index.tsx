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
} from '@rive-app/react-native';
import type { RiveFile } from '@rive-app/react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { theme } from '@/theme';
import { textOf } from '@/ui/tokens';
import { PERSONA_MODELS, PERSONA_STATE_MACHINE, personaInputValues } from './animation';
import type { PersonaProps } from './animation';
import { PERSONA_ASSETS } from './assets';
import { DEFAULT_PERSONA, DEFAULT_PERSONA_COLOR, personaColorOnLight } from './variants';
import type { PersonaVariant } from './variants';

export type { PersonaState, PersonaProps } from './animation';

// Cache the six decoded files. Each rendered view keeps its own animation state.
const fileCache = new Map<PersonaVariant, Promise<RiveFile>>();

const loadFile = async (variant: PersonaVariant) => {
  const cached = fileCache.get(variant);

  if (cached) {
    return await cached;
  }

  const loading = RiveFileFactory.fromSource(PERSONA_ASSETS[variant], undefined, false);
  fileCache.set(variant, loading);

  try {
    return await loading;
  } catch (error) {
    fileCache.delete(variant);
    throw error;
  }
};

// Every persona's file, read ahead, so turning to one in settings doesn't wait on its file.
export const preloadPersonas = (variants: readonly PersonaVariant[]) => {
  for (const variant of variants) {
    void loadFile(variant).catch(() => null);
  }
};

// The default persona's file is read as the app starts, so the call screen's orb doesn't wait on it.
// Until a file is read the orb's place stays empty: it shows only whole.
preloadPersonas([DEFAULT_PERSONA]);

const sameColor = (a: number, b: number) =>
  [0, 8, 16].every((shift) => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)) <= 1);

export const Persona = ({ variant = DEFAULT_PERSONA, ...props }: PersonaProps) => {
  // The persona on screen stays until the next one's file is read, then the two cross-fade, so a
  // change never shows an empty space or pops; each gets a fresh native view, which drops any
  // earlier error.
  const [shown, setShown] = useState(variant);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    let active = true;
    void (async () => {
      await loadFile(variant).catch(() => null);

      if (active) {
        setShown(variant);
      }
    })();

    return () => {
      active = false;
    };
  }, [variant]);
  const size = props.size ?? SIZE;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        key={shown}
        entering={reducedMotion ? undefined : FadeIn.duration(SWAP)}
        exiting={reducedMotion ? undefined : FadeOut.duration(SWAP)}
        style={StyleSheet.absoluteFill}
      >
        <PersonaRenderer variant={shown} {...props} />
      </Animated.View>
    </View>
  );
};

const SIZE = 320;
const SWAP = 150;
const GROW_IN = 1000;

const PersonaRenderer = ({
  variant,
  state = 'idle',
  size = SIZE,
  color = DEFAULT_PERSONA_COLOR,
  palette,
  paused = false,
  drawn = true,
}: PersonaProps & { variant: PersonaVariant }) => {
  const [file, setFile] = useState<RiveFile>();
  const [failed, setFailed] = useState(false);
  const { riveViewRef, setHybridRef } = useRive();
  const { dynamicColor } = PERSONA_MODELS[variant];

  const { instance: colorModel } = useViewModelInstance(dynamicColor ? file : null, {
    async: true,
  });

  // Whether it has played through its grow-in, and whether it should hold still once it has.
  const grown = useRef(false);
  const growing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const still = useRef(false);
  const originalPalette = useRef<number>(undefined);
  const reducedMotion = useReducedMotion();
  const shown = useColorScheme() === 'light' ? personaColorOnLight(color) : color;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await loadFile(variant);

        if (active) {
          setFile(loaded);
        }
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [variant]);

  useEffect(() => {
    still.current = paused || reducedMotion;
  }, [paused, reducedMotion]);
  useEffect(
    () => () => {
      clearTimeout(growing.current);
    },
    [],
  );

  useEffect(() => {
    if (!riveViewRef) {
      return;
    }

    if (dynamicColor && !colorModel) {
      return;
    }

    const pause = () => {
      void riveViewRef.pause().catch(() => {
        setFailed(true);
      });
    };

    try {
      // Input setters resume playback, so a still persona that has grown keeps its frame.
      if (reducedMotion && grown.current) {
        pause();

        return;
      }

      for (const { name, value } of personaInputValues(state)) {
        riveViewRef.setBooleanInputValue(name, value);
      }

      if (variant === 'opal') {
        originalPalette.current ??= riveViewRef.getNumberInputValue('color');
        riveViewRef.setNumberInputValue('color', palette ?? originalPalette.current);
      }

      // The file starts as a dot that grows into its state, and a paused file never advances, so it
      // plays through that once it's drawn, hidden or not, and only then holds still while hidden or
      // with Reduce Motion on. Until it's drawn it can't grow, so it isn't paused on the dot.
      if (!grown.current) {
        riveViewRef.playIfNeeded();

        if (drawn && !growing.current) {
          growing.current = setTimeout(() => {
            grown.current = true;

            if (still.current) {
              pause();
            }
          }, GROW_IN);
        }

        return;
      }

      if (paused) {
        pause();
      } else {
        riveViewRef.playIfNeeded();
      }
    } catch {
      setFailed(true);
    }
  }, [
    riveViewRef,
    state,
    variant,
    palette,
    dynamicColor,
    colorModel,
    reducedMotion,
    paused,
    drawn,
  ]);

  useEffect(() => {
    const property = riveViewRef ? colorModel?.colorProperty('color') : undefined;

    if (!property) {
      return;
    }

    const wanted = RiveColor.fromHexString(shown).toInt();
    property.set(wanted);

    // The first advance after binding writes the file's own color back into the model.
    return property.addListener((value) => {
      if (!sameColor(value, wanted)) {
        property.set(wanted);
      }
    });
  }, [riveViewRef, colorModel, shown]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {failed ? (
        <Text style={{ ...textOf('caption'), color: theme.secondary }}>Visual unavailable</Text>
      ) : (
        file &&
        (!dynamicColor || colorModel) && (
          <RiveView
            hybridRef={setHybridRef}
            file={file}
            stateMachineName={PERSONA_STATE_MACHINE}
            dataBind={colorModel ?? undefined}
            fit={Fit.Contain}
            autoPlay={false}
            onError={() => {
              setFailed(true);
            }}
            style={{ width: size, height: size, backgroundColor: 'transparent' }}
          />
        )
      )}
    </View>
  );
};
