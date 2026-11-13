import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { allOf } from "@/hooks/use-asks";
import type { Chosen } from "@/hooks/use-asks";
import { failure, openURL } from "@/hooks/use-failures";
import type { CallCard } from "@/live/agents";
import { PICK } from "@/live/asks";
import type { AskOption } from "@/live/asks";
import { reachedBy } from "@/live/inbox";
import { circle, theme } from "@/theme";
import { labelOf, metrics, radius, space, textOf } from "@/ui/tokens";

export const CallAsk = ({
  card,
  onAnswer,
  onOpenTask,
}: {
  card: CallCard;
  onAnswer: (option: Chosen) => Promise<void>;
  onOpenTask: () => void;
}) => {
  const { ask } = card;
  const [sending, setSending] = useState<string>();
  const [sent, setSent] = useState<string>();
  const [failed, setFailed] = useState<string>();
  const [chosen, setChosen] = useState<string[]>([]);

  if ((card.answer ?? "") !== "" && ((sent ?? "") !== "" || failed !== undefined)) {
    setSent(undefined);
    setFailed(undefined);
  }

  const answer = card.answer ?? sent;
  const busy = (sending ?? "") !== "";

  const choose = async (option: Chosen) => {
    if (busy) {
      return;
    }

    setSending(option.label);
    setFailed(undefined);

    try {
      await onAnswer(option);
      setSending(undefined);
      setSent(option.label);
    } catch (error) {
      setSending(undefined);
      setFailed(failure("Not sent", error));
    }
  };

  if ((answer ?? "") !== "") {
    return (
      <View style={styles.sent}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.sentText}>
          {`Sent ${answer} to ${ask.topic}`}
          <Text style={styles.quiet}>{reachedBy(ask, card.sent)}</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.title}>
        <View style={styles.head}>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenTask}>
            <Text style={styles.topic}>{`${ask.topic} ›`}</Text>
          </Pressable>
          {(ask.tag ?? "") === "" ? null : <Text style={styles.tag}>{ask.tag}</Text>}
        </View>
        <Text selectable style={styles.question}>
          {ask.question}
        </Text>
      </View>
      <View style={styles.options}>
        {ask.options.map((option) => {
          const on = chosen.includes(option.label);

          return (
            <CallOption
              key={option.label}
              option={option}
              selected={on || sending === option.label}
              chosen={on}
              dim={busy && sending !== option.label}
              onPress={() => {
                if (ask.multiple !== true) {
                  void choose(option);
                } else if (on) {
                  setChosen(chosen.filter((label) => label !== option.label));
                } else {
                  setChosen([...chosen, option.label]);
                }
              }}
            />
          );
        })}
      </View>
      {ask.multiple === true ? (
        <SendPicks
          count={chosen.length}
          busy={busy}
          onPress={() => {
            void choose(allOf(ask, chosen));
          }}
        />
      ) : null}
      {ask.links !== undefined && ask.links.length > 0 ? (
        <View style={styles.links}>
          {ask.links.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              hitSlop={8}
              onPress={async () => {
                try {
                  await openURL(link.url);
                } catch (error) {
                  setFailed(failure("Not opened", error));
                }
              }}
            >
              <Text style={styles.link}>{`${link.label} ↗`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {failed === undefined ? (
        <Text style={styles.hint}>
          {busy
            ? `Sending ${sending}…`
            : `${ask.multiple === true ? "Pick one or more" : "Tap"}, or just say it`}
        </Text>
      ) : (
        <Text accessibilityRole="alert" style={[styles.hint, styles.failed]}>
          {failed}
        </Text>
      )}
    </View>
  );
};

const CallOption = ({
  option,
  selected,
  chosen,
  dim,
  onPress,
}: {
  option: AskOption;
  selected: boolean;
  chosen: boolean;
  dim: boolean;
  onPress: () => void;
}) => {
  const pick = option.pick === true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pick ? `${option.label}, ${PICK}` : option.label}
      accessibilityState={{ selected, disabled: dim }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        pick && styles.pick,
        chosen && styles.chosen,
        (pressed || dim) && styles.pressed,
      ]}
    >
      <Text style={[styles.optionText, pick && styles.pickText]}>{option.label}</Text>
      {pick ? <Text style={styles.pickNote}>{PICK}</Text> : null}
    </Pressable>
  );
};

const SendPicks = ({
  count,
  busy,
  onPress,
}: {
  count: number;
  busy: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: count === 0 || busy }}
    disabled={count === 0 || busy}
    onPress={onPress}
    style={({ pressed }) => [styles.send, count === 0 && styles.idle, pressed && styles.pressed]}
  >
    <Text style={[styles.sendText, count === 0 && styles.idleText]}>
      {count ? `Answer with ${count}` : "Answer"}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: theme.surface,
    borderRadius: radius.group,
    borderCurve: "continuous",
    padding: space[4],
    gap: space[3],
  },
  title: { gap: space[2] },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
    paddingHorizontal: space[0.5],
  },
  topic: { ...labelOf("caption", "medium"), color: theme.secondary },
  question: { ...textOf("headline"), color: theme.text, paddingHorizontal: space[0.5] },
  tag: {
    ...labelOf("caption", "medium"),
    color: theme.text,
    backgroundColor: theme.surfaceSelected,
    borderRadius: radius.inner,
    overflow: "hidden",
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  option: {
    minHeight: metrics.pill.regular,
    justifyContent: "center",
    paddingHorizontal: space[4],
    borderRadius: radius.option,
    borderCurve: "continuous",
    backgroundColor: theme.surfaceSelected,
  },
  pick: { backgroundColor: theme.accentMuted, paddingVertical: space[2] },
  pickText: { ...labelOf("body", "medium"), color: theme.text },
  pickNote: { ...labelOf("caption"), color: theme.accent },
  chosen: { outlineWidth: 2, outlineColor: theme.text, outlineOffset: -2 },
  send: {
    minHeight: metrics.pill.regular,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.option,
    borderCurve: "continuous",
    backgroundColor: theme.prominent,
  },
  sendText: { ...labelOf("body", "medium"), color: theme.onProminent },
  idle: { backgroundColor: theme.surfaceSelected },
  idleText: { color: theme.tertiary },
  pressed: { opacity: 0.6 },
  optionText: { ...labelOf("body"), color: theme.text },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[4],
    paddingHorizontal: space[0.5],
  },
  link: { ...labelOf("detail"), color: theme.secondary },
  hint: { ...labelOf("caption"), color: theme.tertiary, textAlign: "center" },
  failed: { color: theme.danger },
  sent: { flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingRight: space[6] },
  check: {
    ...circle(26),
    backgroundColor: theme.surfaceSelected,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { ...labelOf("caption", "medium"), color: theme.secondary },
  sentText: { ...textOf("body"), flex: 1, color: theme.text },
  quiet: { color: theme.secondary },
});
