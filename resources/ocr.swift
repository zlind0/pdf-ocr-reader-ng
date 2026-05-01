import Foundation
import Vision
import AppKit

// This standalone Swift script is compiled by the app on first launch.
// It uses Apple's Vision framework for high-accuracy OCR.
// Usage: ocr-engine <image-path>

let args = CommandLine.arguments
guard args.count > 1 else {
    print("{\"error\": \"No image path provided\"}")
    exit(1)
}

let imagePath = args[1]
guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("{\"error\": \"Could not load image from \\(imagePath)\"}")
    exit(1)
}

struct TextBlock: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
// Multi-language support — Vision will auto-detect
request.recognitionLanguages = [
    "zh-Hans", "zh-Hant", "ja", "ko",
    "en-US", "de-DE", "fr-FR", "es-ES",
    "ru-RU", "it-IT", "pt-BR"
]

do {
    try requestHandler.perform([request])
} catch {
    print("{\"error\": \"Vision request failed: \\(error.localizedDescription)\"}")
    exit(1)
}

var blocks: [TextBlock] = []
if let observations = request.results {
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let bbox = observation.boundingBox
        // Vision coordinate system: origin at bottom-left, y increasing upward.
        // Convert to top-left origin (web/CSS convention).
        blocks.append(TextBlock(
            text: candidate.string,
            confidence: candidate.confidence,
            x: bbox.origin.x,
            y: 1.0 - bbox.origin.y - bbox.size.height,
            width: bbox.size.width,
            height: bbox.size.height
        ))
    }
}

let encoder = JSONEncoder()
do {
    let data = try encoder.encode(["blocks": blocks])
    if let jsonString = String(data: data, encoding: .utf8) {
        print(jsonString)
    }
} catch {
    print("{\"error\": \"Failed to encode result: \\(error.localizedDescription)\"}")
    exit(1)
}
