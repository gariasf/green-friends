import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  ActionSheetIOS,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ImageStyle,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findFocus } from '@/modules/photo-focus';
import {
  framePosition,
  photosWithoutFocus,
  setPhotoFocus,
  type Focus,
  type PhotoFiles,
} from '@/src/core/photos';
import { db } from '@/src/db/client';
import { alertError, TextButton } from '@/src/ui/Form';
import { colors, font, radius, space, text } from '@/src/ui/theme';

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

/**
 * Finds a Focal point for each live photo without one (spec #67), one at a time: photos from
 * before Focal points or from an older Export, or whose point Vision couldn't find when they
 * were added. A photo it fails on keeps none, to be tried again next time.
 */
export async function findMissingFocus(): Promise<void> {
  for (const photo of photosWithoutFocus(db)) {
    try {
      setPhotoFocus(db, photo.id, await findFocus(Paths.join(folder, photo.filename)));
    } catch {
      // Framed on its centre until the next launch tries again.
    }
  }
}

/** findMissingFocus, once at launch, from the root layout. */
export function useFindMissingFocus(): void {
  useEffect(() => void findMissingFocus(), []);
}

/** The long edge of a stored photo, in pixels (ADR-0001). */
const LONG_EDGE = 1600;

/**
 * A picked photo, prepared for setPlantPhoto, with its Focal point: none where Vision found none
 * and the user left the centre as it was, so the launch pass tries again (useFindMissingFocus).
 */
export type Picked = { prepared: string; focus: Focus | null };

/** A photo as Frame photo opens on it: its point, or its centre where Vision found none. */
type Found = { prepared: string; focus: Focus; byVision: boolean };

/** The Plant screen's hero, as tall as this share of its width. */
export const HERO_HEIGHT = 0.92;

/** "Add photo", or "Replace photo" once there is one: usePhotoPicker as a button. */
export function PhotoButton({
  hasPhoto,
  onPick,
}: {
  hasPhoto: boolean;
  onPick: (picked: Picked) => void;
}) {
  const picker = usePhotoPicker(onPick);
  return (
    <>
      <TextButton label={hasPhoto ? 'Replace photo' : 'Add photo'} onPress={picker.choose} />
      {picker.framing}
    </>
  );
}

/**
 * Picking a photo: `choose` asks for one, prepares it for setPlantPhoto and finds its Focal
 * point, then `framing`, which the screen renders, shows Frame photo to correct the point (spec
 * #67). Use Photo hands the photo and its point to `onPick`; Cancel drops it. There's no
 * repositioning after that.
 */
export function usePhotoPicker(onPick: (picked: Picked) => void): {
  choose: () => void;
  framing: ReactNode;
} {
  const [found, setFound] = useState<Found | null>(null);
  return {
    choose: () => void choosePhoto(setFound),
    framing: found && (
      <FramePhoto
        key={found.prepared}
        found={found}
        onCancel={() => {
          deleteIfThere(new File(found.prepared));
          setFound(null);
        }}
        onUse={(focus, moved) => {
          setFound(null);
          onPick({ prepared: found.prepared, focus: found.byVision || moved ? focus : null });
        }}
      />
    ),
  };
}

/**
 * Asks for a photo, prepares it for setPlantPhoto, finds its Focal point and hands both to
 * `onFound`, telling the user when picking or preparing fails. Where Vision finds no point (the
 * simulator never does), the photo's centre.
 */
async function choosePhoto(onFound: (found: Found) => void): Promise<void> {
  let prepared: string | null = null;
  try {
    prepared = await pickPhoto();
    if (!prepared) return;
    const file = prepared;
    const found = await findFocus(file).then(
      (focus) => ({ prepared: file, focus, byVision: true }),
      async () => {
        const { width, height } = await Image.getSize(file);
        return {
          prepared: file,
          focus: { x: 0.5, y: 0.5, aspect: width / height },
          byVision: false,
        };
      },
    );
    onFound(found);
  } catch (error) {
    // A photo that got no further than preparing is dropped, as Cancel drops it.
    if (prepared) deleteIfThere(new File(prepared));
    alertError('Could not add the photo', error);
  }
}

/** The tallest the whole photo stands in Frame photo, as a share of the screen's height. */
const FRAME_HEIGHT = 0.45;

/**
 * Frame photo (spec #67): the whole photo with a marker on its Focal point, which a drag or a
 * tap moves, and beneath it how the Garden's square and the Plant screen's hero frame it.
 */
function FramePhoto({
  found,
  onCancel,
  onUse,
}: {
  found: Found;
  onCancel: () => void;
  onUse: (focus: Focus, moved: boolean) => void;
}) {
  const [focus, setFocus] = useState(found.focus);
  const moved = focus !== found.focus;
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The whole photo, as wide as the sheet allows, no taller than FRAME_HEIGHT of the screen.
  const width = Math.min(window.width - 2 * space.l, window.height * FRAME_HEIGHT * focus.aspect);
  const height = width / focus.aspect;
  // A new responder when the photo's size changes, so a drag reads the size it's drawn at.
  const pan = useMemo(() => {
    const on = (at: number, length: number) => Math.min(1, Math.max(0, at / length));
    const move = ({ nativeEvent }: GestureResponderEvent) =>
      setFocus((point) => ({
        ...point,
        x: on(nativeEvent.locationX, width),
        y: on(nativeEvent.locationY, height),
      }));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: move,
      onPanResponderMove: move,
      onPanResponderTerminationRequest: () => false,
    });
  }, [width, height]);
  const heroWidth = 132;
  const heroHeight = heroWidth * HERO_HEIGHT;
  const square = heroHeight;

  return (
    // Full screen, as iOS's own crop is: a sheet's pan takes the drag away from the marker.
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <TextButton label="Cancel" header onPress={onCancel} />
          <Text accessibilityRole="header" style={text.headline}>
            Frame photo
          </Text>
          <TextButton label="Use Photo" header onPress={() => onUse(focus, moved)} />
        </View>
        <Text style={[text.subheadline, styles.hint]}>
          Drag to the part of the plant to keep in view.
        </Text>
        <View
          {...pan.panHandlers}
          accessible
          accessibilityLabel="Photo, framed where the plant was found"
          style={[styles.whole, { width, height }]}
        >
          <Image source={{ uri: found.prepared }} style={StyleSheet.absoluteFill} />
          <View
            pointerEvents="none"
            style={[styles.marker, { left: focus.x * width - 14, top: focus.y * height - 14 }]}
          />
        </View>
        <View accessibilityElementsHidden style={styles.previews}>
          <View style={styles.preview}>
            <PlantPhoto uri={found.prepared} focus={focus} size={square} name="" />
            <Text style={text.footnote}>In the Garden</Text>
          </View>
          <View style={styles.preview}>
            <View style={[styles.hero, { width: heroWidth, height: heroHeight }]}>
              <Image
                source={{ uri: found.prepared }}
                style={coverStyle(focus, heroWidth, heroHeight)}
              />
            </View>
            <Text style={text.footnote}>On its page</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
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
  sheet: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  bar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.s,
  },
  hint: { marginTop: space.s, marginBottom: space.l, marginHorizontal: space.l },
  whole: { borderRadius: radius.inner, borderCurve: 'continuous', overflow: 'hidden' },
  marker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.onPhoto,
    boxShadow: colors.markerShadow,
  },
  previews: { flexDirection: 'row', gap: space.xxl, marginTop: space.xxl },
  preview: { alignItems: 'center', gap: space.s },
  hero: { borderRadius: radius.inner, borderCurve: 'continuous', overflow: 'hidden' },
  photo: {
    borderRadius: radius.inner,
    borderCurve: 'continuous',
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
