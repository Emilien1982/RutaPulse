package fr.vttnav.valhallaroute

import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.config.models.AdditionalData
import com.valhalla.valhalla.Valhalla
import com.valhalla.valhalla.ValhallaException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import org.json.JSONObject

private fun nativeError(code: String, message: String, cause: Throwable? = null) =
    CodedException(code, message, cause)

// valhalla-mobile keeps the code only in the exception text: "ValhallaError(code=171, ...)".
private val CODE_PATTERN = Regex("""code=(-?\d+)""")

// Bridge to valhalla-mobile (ADR 0015). One engine at a time, guarded by a lock.
class ValhallaRouteModule : Module() {
  private val lock = Any()
  private var valhalla: Valhalla? = null

  private fun closeEngine() {
    synchronized(lock) {
      valhalla?.close()
      valhalla = null
    }
  }

  private fun currentEngine(): Valhalla =
      synchronized(lock) {
        valhalla ?: throw nativeError("ERR_ENGINE_NOT_OPEN", "The engine is not open")
      }

  private fun errorJson(error: ValhallaException.Internal): String {
    val text = error.message ?: ""
    val code = CODE_PATTERN.find(text)?.groupValues?.get(1)?.toIntOrNull() ?: -1
    return JSONObject().put("code", code).put("message", text).toString()
  }

  // Same errors for every call: a refusal of Valhalla comes back as JSON.
  private fun guarded(call: (Valhalla) -> String): String {
    val engine = currentEngine()
    return try {
      call(engine)
    } catch (e: ValhallaException.Internal) {
      errorJson(e)
    } catch (e: Exception) {
      throw nativeError("ERR_ENGINE", e.message ?: "Engine error", e)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ValhallaRoute")

    AsyncFunction("open") { tarPath: String, elevationDir: String ->
      closeEngine()
      if (!File(tarPath).isFile) {
        throw nativeError("ERR_ZONE_UNREADABLE", "Tile file not found: $tarPath")
      }
      val context =
          appContext.reactContext ?: throw nativeError("ERR_ENGINE", "No Android context")
      val instance =
          try {
            val config =
                ValhallaConfigBuilder()
                    .withTileExtract(tarPath)
                    .build()
                    .copy(additionalData = AdditionalData(elevation = elevationDir))
            Valhalla(context, config)
          } catch (e: Exception) {
            throw nativeError("ERR_ZONE_UNREADABLE", e.message ?: "Cannot open the zone", e)
          }
      synchronized(lock) { valhalla = instance }
    }

    AsyncFunction("close") { closeEngine() }

    AsyncFunction("route") { requestJson: String -> guarded { it.routeRaw(requestJson) } }

    AsyncFunction("height") { requestJson: String -> guarded { it.heightRaw(requestJson) } }

    AsyncFunction("traceAttributes") { requestJson: String ->
      guarded { it.traceAttributesRaw(requestJson) }
    }

    OnDestroy { closeEngine() }
  }
}
