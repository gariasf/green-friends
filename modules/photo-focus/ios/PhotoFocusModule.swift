import CoreVideo
import ExpoModulesCore
import ImageIO
import Vision

/// A photo's Focal point (spec #67, ADR-0010): the centre of where Vision's attention saliency
/// says the eye goes, x and y from its top-left, 0 to 1, with its width over its height.
public class PhotoFocusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoFocus")

    AsyncFunction("findFocus") { (uri: URL) -> [String: Double] in
      // The app's own JPEGs, prepared upright (prepare in src/ui/Photo.tsx), so no EXIF orientation.
      guard let source = CGImageSourceCreateWithURL(uri as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
      else { throw NoPhotoException(uri.lastPathComponent) }
      let aspect = Double(image.width) / Double(image.height)

      // Attention, not objectness: objectness takes a pot for the plant's middle (#62, ADR-0010).
      // The simulator can't run this model: it throws there ("Could not create inference
      // context"), or with usesCPUOnly finds the same point in every photo, so it's left to throw.
      let request = VNGenerateAttentionBasedSaliencyImageRequest()
      try VNImageRequestHandler(cgImage: image).perform([request])
      guard let heat = request.results?.first?.pixelBuffer,
        let (x, y) = centroid(of: heat)
      else { return ["x": 0.5, "y": 0.5, "aspect": aspect] }
      return ["x": x, "y": y, "aspect": aspect]
    }
  }
}

/// The weighted centre of a saliency heat map (one Float per cell, top row first), each cell
/// weighed by its heat squared so the hottest part leads; nil for a map with no heat.
private func centroid(of heat: CVPixelBuffer) -> (Double, Double)? {
  CVPixelBufferLockBaseAddress(heat, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(heat, .readOnly) }
  guard let base = CVPixelBufferGetBaseAddress(heat)?.assumingMemoryBound(to: Float.self)
  else { return nil }
  let width = CVPixelBufferGetWidth(heat)
  let height = CVPixelBufferGetHeight(heat)
  let row = CVPixelBufferGetBytesPerRow(heat) / MemoryLayout<Float>.size
  var sumX = 0.0, sumY = 0.0, total = 0.0
  for y in 0..<height {
    for x in 0..<width {
      let cell = Double(max(0, base[y * row + x]))
      let weight = cell * cell
      sumX += weight * (Double(x) + 0.5)
      sumY += weight * (Double(y) + 0.5)
      total += weight
    }
  }
  guard total > 0 else { return nil }
  return (sumX / total / Double(width), sumY / total / Double(height))
}

internal final class NoPhotoException: GenericException<String> {
  override var reason: String { "Could not read the photo \(param)" }
}
