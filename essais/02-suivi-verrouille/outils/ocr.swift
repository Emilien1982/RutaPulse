// Read the text of a PNG with Vision. Usage: swift ocr.swift image.png
// Prints one recognized line per output line, top to bottom.
import Foundation
import Vision

guard CommandLine.arguments.count > 1 else { FileHandle.standardError.write("usage: ocr image.png\n".data(using: .utf8)!); exit(1) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["fr-FR", "en-US"]
let handler = VNImageRequestHandler(url: url, options: [:])
do { try handler.perform([request]) } catch { FileHandle.standardError.write("ocr error: \(error)\n".data(using: .utf8)!); exit(2) }
let obs = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
for o in obs { if let c = o.topCandidates(1).first { print(c.string) } }
