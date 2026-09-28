# ADR-0010: Photos framed on a Focal point, found by Vision

Status: accepted (2026-09-28) · Spec: [#67](https://github.com/gariasf/green-friends/issues/67) · Options: [#62](https://github.com/gariasf/green-friends/issues/62)

Every frame used to crop a photo on its centre, at its own ratio: squares in the Garden, on Today and in the lists, about 1:0.92 in the Plant screen's hero, and 3:2 in the Web view's Plant pane. A plant that wasn't centred lost its best part.

## Decision

- **One point per photo, not crops.** `photos` gets `focus_x`, `focus_y` (0 to 1 from the top-left) and `aspect` (width over height): all three set, or none, which means the centre. Only one photo is stored. Each frame works out its crop from the point with core's `framePosition`, which the phone (`coverStyle`) and the Web view (`object-position`) share. The columns go out verbatim in the Export, so the Snapshot carries them too.
- **Found on the phone, by Apple Vision.** `VNGenerateAttentionBasedSaliencyImageRequest` runs once on each prepared JPEG. The point is its heat map's centroid, each cell weighed by its heat squared, or the centre for a map with no heat. It needs no network, key or model download. Objectness, the request #62 named first, was tried on the test garden's five photos and an off-centre one (on the Mac, 2026-09-28). Its boxes put the point on the pot in four of the six, while the attention centroid landed on the leaves in all six.
- **Our first native code: a local Expo module** (`modules/photo-focus`, Swift, autolinked), so the app stays CNG and `ios/` is never edited by hand (ADR-0001). The Web view never finds a point. It only reads the stored one.
- **Corrected once, right after picking, and never repositioned** (the owner, 2026-09-28). A photo without a point, whether from before this or from an older Export, gets one found once at launch.

## Considered options

- **By hand only**: all TypeScript, but it costs one drag per photo, and existing photos would stay centred.
- **A plant-specific model**: ADR-0007 already found on-device BioCLIP too weak.
- **The picker's own crop** (`allowsEditing`): on iOS it crops to a square and saves only the crop, so the Web view's 3:2 hero would lose the rest of the photo for good.
- **Width and height columns instead of `aspect`**: two numbers where framing needs one.

## Consequences

- A change to the Swift needs a prebuild and a native build. JS-only changes still load from Metro.
- Attention finds where the eye goes, not "the plant": a busy background can pull the point off it, and a plant filling one side of a plain photo gets a point short of its middle, since the plain side still holds some heat. The Frame photo step is there to correct it.
- The simulator's Vision can't run the model: it fails ("Could not create inference context"), or with `usesCPUOnly` returns the same point for every photo. Check Vision on a device, or with a Mac command-line tool over the same request. Check framing on the simulator with points set by hand.
- Import checks the point (whole, on the photo, a positive aspect) like any other rule of the mutations (ADR-0002).
