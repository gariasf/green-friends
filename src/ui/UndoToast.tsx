import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteCareEvent } from '@/src/core/careLog';
import { db } from '@/src/db/client';
import { TextButton } from '@/src/ui/Form';
import { colors, space, text } from '@/src/ui/theme';

const UNDO_MS = 4000;

type Undo = { message: string; eventIds: string[] };

/**
 * The undo toast after care logged in one tap: `offer` shows it for a few seconds, its message
 * announced to VoiceOver, and its Undo deletes those Care Events, then runs `onUndone`. `toast`
 * floats above the screen, so it goes after the screen's ScrollView, not inside it.
 */
export function useUndoToast(onUndone?: () => void) {
  const [undo, setUndo] = useState<Undo | null>(null);

  useEffect(() => {
    if (!undo) return;
    AccessibilityInfo.announceForAccessibility(`${undo.message}. Undo available.`);
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const revert = ({ eventIds }: Undo) => {
    for (const id of eventIds) deleteCareEvent(db, id);
    onUndone?.();
    setUndo(null);
  };

  return {
    offer: (message: string, eventIds: string[]) => setUndo({ message, eventIds }),
    toast: undo && <UndoToast message={undo.message} onUndo={() => revert(undo)} />,
  };
}

function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toast, { bottom: insets.bottom + space.m }]}>
      <Text style={styles.toastText}>{message}</Text>
      <TextButton label="Undo" onPress={onUndo} />
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    borderRadius: 14,
    backgroundColor: colors.floating,
    // Black, iOS's default shadow colour.
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { ...text.subheadline, flex: 1, fontWeight: '600', color: colors.label },
});
