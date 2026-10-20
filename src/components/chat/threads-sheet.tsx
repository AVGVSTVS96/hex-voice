import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TaskRow, TaskState } from '@/live/tasks';
import { theme } from '@/theme';

// Every thread hex has, to chat in any of them: General first, then the rest as Activity orders
// them, what needs you before what's working before what's done.
export function ThreadsSheet({
  open,
  rows,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  rows: TaskRow[];
  current?: string;
  onPick: (row: TaskRow) => void;
  onClose: () => void;
}) {
  const ordered = [...rows.filter(isGeneral), ...rows.filter((row) => !isGeneral(row))];
  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>Threads</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {ordered.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityState={{ selected: row.id === current }}
              onPress={() => onPick(row)}
              style={({ pressed }) => [
                styles.row,
                (pressed || row.id === current) && styles.picked,
              ]}
            >
              <View style={[styles.dot, { backgroundColor: DOT[row.state] }]} />
              <View style={styles.words}>
                <Text numberOfLines={1} style={styles.name}>
                  {titleOf(row)}
                </Text>
                {!!row.line && (
                  <Text numberOfLines={1} style={styles.line}>
                    {row.line}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export const isGeneral = (row: TaskRow) => row.place === 'General';

// General is hex's own chat, so it goes by hex's name; every other thread by its place's.
export const titleOf = (row: TaskRow) => (isGeneral(row) ? 'hex' : row.place);

const DOT: Record<TaskState, typeof theme.text> = {
  needs: theme.accent,
  working: theme.switchOn,
  failed: theme.danger,
  done: theme.tertiary,
  idle: theme.edge,
};

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: theme.sheet },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: '700' },
  done: { color: theme.text, fontSize: 17, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  picked: { backgroundColor: theme.surface },
  dot: { width: 8, height: 8, borderRadius: 4 },
  words: { flex: 1, gap: 2 },
  name: { color: theme.text, fontSize: 17, fontWeight: '500' },
  line: { color: theme.secondary, fontSize: 14 },
});
