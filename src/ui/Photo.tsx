import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Image, StyleSheet, Text, View, type ImageStyle } from 'react-native';

import { findFocus } from '@/modules/photo-focus';
import { framePosition, type Focus, type PhotoFiles } from '@/src/core/photos';
import { alertError, TextButton } from '@/src/ui/Form';
import { colors, font, radius } from '@/src/ui/theme';

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

/** A picked photo, prepared for setPlantPhoto, with the Focal point found in it. */
export type Picked = { prepared: string; focus: Focus | null };

/** "Add photo", or "Replace photo" once there is one: choosePhoto as a button. */
export function PhotoButton({
  hasPhoto,
  onPick,
}: {
  hasPhoto: boolean;
  onPick: (picked: Picked) => void;
}) {
  return (
    <TextButton
      label={hasPhoto ? 'Replace photo' : 'Add photo'}
      onPress={() => choosePhoto(onPick)}
    />
  );
}

/**
 * Asks for a photo, prepares it for setPlantPhoto, finds its Focal point and hands both to
 * `onPick`, telling the user when picking or preparing fails. A point Vision can't find is none,
 * the photo framed on its centre.
 */
export async function choosePhoto(onPick: (picked: Picked) => void): Promise<void> {
  try {
    const prepared = await pickPhoto();
    if (!prepared) return;
    onPick({ prepared, focus: await findFocus(prepared).catch(() => null) });
  } catch (error) {
    alertError('Could not add the photo', error);
  }
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

/** The image at `uri` as a new JPEG at most `longEdge` pixels on its long edge. */
export async function prepare(uri: string, longEdge = LONG_EDGE): Promise<string> {
  // Decoded first, EXIF orientation applied, so the long edge is the one the photo shows with.
  const loading = ImageManipulator.manipulate(uri);
  const original = await loading.renderAsync();
  const resizing = ImageManipulator.manipulate(original);
  const { width, height } = original;
  if (Math.max(width, height) > longEdge) {
    resizing.resize(width >= height ? { width: longEdge } : { height: longEdge });
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

/**
 * The style of a photo covering a `width` × `height` frame, placed so the frame centres on its
 * Focal point (framePosition); without one, React Native's own cover, on the centre. The frame
 * clips it.
 */
export function coverStyle(focus: Focus | null, width: number, height: number): ImageStyle {
  if (!focus) return StyleSheet.absoluteFill;
  const frame = width / height;
  const wide = focus.aspect > frame;
  const w = wide ? height * focus.aspect : width;
  const h = wide ? height : width / focus.aspect;
  const { x, y } = framePosition(focus, frame);
  return {
    position: 'absolute',
    width: w,
    height: h,
    left: (width - w) * x,
    top: (height - h) * y,
  };
}

/**
 * A plant's photo as a rounded square framed on its Focal point, or its initial on Ecru while it
 * has none; `radius` is `radius.inner` unless given (the Garden grid's are `radius.surface`).
 */
export function PlantPhoto({
  uri,
  focus = null,
  size,
  name,
  radius: borderRadius,
}: {
  uri: string | null;
  focus?: Focus | null;
  size: number;
  name: string;
  radius?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.photo,
        { width: size, height: size },
        borderRadius != null && { borderRadius },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={coverStyle(focus, size, size)} />
      ) : (
        <Initial name={name} size={size} />
      )}
    </View>
  );
}

/**
 * What stands in for a missing photo (#55, variant D on prototype/quiet-icons): the first letter
 * of the plant's name in Young Serif, in the tint; nothing while it has no name yet.
 */
export function Initial({ name, size }: { name: string; size: number }) {
  return (
    <Text
      allowFontScaling={false}
      style={[font.title, { fontSize: size * 0.46, color: colors.tint }]}
    >
      {name.trim().charAt(0).toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderRadius: radius.inner,
    borderCurve: 'continuous',
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
