import ExpoModulesCore
import Valhalla
import ValhallaConfigModels

private func nativeError(_ code: String, _ message: String) -> Exception {
  Exception(name: code, description: message, code: code)
}

// Bridge to valhalla-mobile (ADR 0015). One engine at a time, guarded by a lock.
public class ValhallaRouteModule: Module {
  private var valhalla: Valhalla?
  private let lock = NSLock()

  private func closeEngine() {
    lock.lock()
    defer { lock.unlock() }
    valhalla?.close()
    valhalla = nil
  }

  private func currentEngine() throws -> Valhalla {
    lock.lock()
    defer { lock.unlock() }
    guard let engine = valhalla else {
      throw nativeError("ERR_ENGINE_NOT_OPEN", "The engine is not open")
    }
    return engine
  }

  private func errorJson(_ code: Int, _ message: String) -> String {
    let object: [String: Any] = ["code": code, "message": message]
    guard let data = try? JSONSerialization.data(withJSONObject: object),
      let text = String(data: data, encoding: .utf8)
    else {
      return "{\"code\":\(code),\"message\":\"\"}"
    }
    return text
  }

  // Same errors for every call: a refusal of Valhalla comes back as JSON.
  private func guarded(_ call: (Valhalla) throws -> String) throws -> String {
    let engine = try currentEngine()
    do {
      return try call(engine)
    } catch ValhallaError.valhallaError(let code, let message) {
      return errorJson(code, message)
    } catch ValhallaError.closed {
      throw nativeError("ERR_ENGINE_NOT_OPEN", "The engine is closed")
    } catch {
      throw nativeError("ERR_ENGINE", String(describing: error))
    }
  }

  public func definition() -> ModuleDefinition {
    Name("ValhallaRoute")

    AsyncFunction("open") { (tarPath: String, elevationDir: String) in
      self.closeEngine()
      guard FileManager.default.fileExists(atPath: tarPath) else {
        throw nativeError("ERR_ZONE_UNREADABLE", "Tile file not found: \(tarPath)")
      }
      let instance: Valhalla
      do {
        let config = try ValhallaConfig(
          tileExtractTar: URL(fileURLWithPath: tarPath),
          elevationDir: URL(fileURLWithPath: elevationDir))
        instance = try Valhalla(config)
      } catch {
        throw nativeError("ERR_ZONE_UNREADABLE", String(describing: error))
      }
      self.lock.lock()
      self.valhalla = instance
      self.lock.unlock()
    }

    AsyncFunction("close") {
      self.closeEngine()
    }

    AsyncFunction("route") { (requestJson: String) -> String in
      try self.guarded { try $0.route(rawRequest: requestJson) }
    }

    AsyncFunction("height") { (requestJson: String) -> String in
      try self.guarded { try $0.height(rawRequest: requestJson) }
    }

    AsyncFunction("traceAttributes") { (requestJson: String) -> String in
      try self.guarded { try $0.traceAttributes(rawRequest: requestJson) }
    }

    OnDestroy {
      self.closeEngine()
    }
  }
}
