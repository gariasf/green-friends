import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { ActionSheetIOS, Image, StyleSheet, View } from 'react-native';

import type { PhotoFiles } from '@/src/core/photos';
import { alertError, TextButton } from '@/src/ui/Form';
import { colors } from '@/src/ui/theme';

/** Photo files live in the documents directory, which the system never clears, under photos/ (ADR-0001). */
const folder = new Directory(Paths.document, 'photos');

/** The app's photo folder, for the core's photo mutations. */
export const photoFiles: PhotoFiles = {
  store(source, filename) {
    folder.create({ intermediates: true, idempotent: true });
    new File(source).moveSync(new File(folder, filename));
  },
  write(filename, bytes) {
    folder.create({ intermediates: true, idempotent: true });
    new File(folder, filename).write(bytes);
  },
  read(filename) {
    return new File(folder, filename).bytesSync();
  },
  remove(filename) {
    deleteIfThere(new File(folder, filename));
  },
  removeAll() {
    // The folder goes with its files; the next store makes it again.
    if (folder.exists) folder.delete();
  },
};

/** Where a stored photo is on this install; the database keeps only its filename. */
export function photoUri(filename: string | null): string | null {
  return filename === null ? null : Paths.join(folder, filename);
}

/** The long edge of a stored photo, in pixels (ADR-0001). */
const LONG_EDGE = 1600;

/**
 * "Add photo", or "Replace photo" once there is one: asks for a photo, prepares it for
 * setPlantPhoto and hands the prepared file to `onPick`, telling the user when either fails.
 */
export function PhotoButton({
  hasPhoto,
  onPick,
}: {
  hasPhoto: boolean;
  onPick: (prepared: string) => void;
}) {
  const choose = async () => {
    try {
      const prepared = await pickPhoto();
      if (prepared) onPick(prepared);
    } catch (error) {
      alertError('Could not add the photo', error);
    }
  };
  return <TextButton label={hasPhoto ? 'Replace photo' : 'Add photo'} onPress={choose} />;
}

/**
 * Asks for a photo from the camera or the library and prepares it. Resolves to the prepared
 * file, or null when the user backs out.
 */
async function pickPhoto(): Promise<string | null> {
  const source = await chooseSource();
  if (source === null) return null;
  if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
    throw new Error('Allow Green Friends to use the camera in Settings, then try again.');
  }
  const picked = await (source === 'camera'
    ? ImagePicker.launchCameraAsync()
    : ImagePicker.launchImageLibraryAsync());
  if (picked.canceled) return null;
  const { uri } = picked.assets[0];
  try {
    return await prepare(uri);
  } finally {
    // The picker's full-size copy, prepared or not: no original is kept.
    deleteIfThere(new File(uri));
  }
}

/** The image at `uri` as a JPEG at most LONG_EDGE pixels on its long edge. */
async function prepare(uri: string): Promise<string> {
  // Decoded first, EXIF orientation applied, so the long edge is the one the photo shows with.
  const loading = ImageManipulator.manipulate(uri);
  const original = await loading.renderAsync();
  const resizing = ImageManipulator.manipulate(original);
  const { width, height } = original;
  if (Math.max(width, height) > LONG_EDGE) {
    resizing.resize(width >= height ? { width: LONG_EDGE } : { height: LONG_EDGE });
  }
  const resized = await resizing.renderAsync();
  const prepared = await resized.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  // Native images hold megabytes each; free them now rather than at the next garbage collection.
  for (const native of [loading, original, resizing, resized]) native.release();
  return prepared.uri;
}

function chooseSource(): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Take Photo', 'Choose from Library', 'Cancel'], cancelButtonIndex: 2 },
      (index) => resolve(index === 0 ? 'camera' : index === 1 ? 'library' : null),
    ),
  );
}

function deleteIfThere(file: File): void {
  if (file.exists) file.delete();
}

/** A plant's photo as a rounded square, or a leaf while it has none. */
export function PlantPhoto({ uri, size }: { uri: string | null; size: number }) {
  return (
    <View accessibilityElementsHidden style={[styles.photo, { width: size, height: size }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} />
      ) : (
        <SymbolView name="leaf.fill" size={size * 0.45} tintColor={colors.tint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderRadius: 14,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
