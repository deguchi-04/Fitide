package com.thaidy.forma

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@CapacitorPlugin(name = "FitideHealth")
class FitideHealthPlugin : Plugin() {
    private companion object {
        const val READ_STEPS = "android.permission.health.READ_STEPS"
        const val READ_TOTAL_CALORIES_BURNED = "android.permission.health.READ_TOTAL_CALORIES_BURNED"
        const val READ_HEART_RATE = "android.permission.health.READ_HEART_RATE"
        const val READ_SLEEP = "android.permission.health.READ_SLEEP"
        const val READ_BODY_FAT = "android.permission.health.READ_BODY_FAT"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @PluginMethod
    fun readToday(call: PluginCall) {
        scope.launch {
            try {
                if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
                    call.reject("O Health Connect não está disponível ou precisa de atualização.", "HEALTH_UNAVAILABLE")
                    return@launch
                }

                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                val permissions = linkedMapOf(
                    "steps" to READ_STEPS,
                    "activeCalories" to READ_TOTAL_CALORIES_BURNED,
                    "averageHeartRate" to READ_HEART_RATE,
                    "sleepMinutes" to READ_SLEEP,
                    "bodyFatPercent" to READ_BODY_FAT,
                )
                val missing = permissions.filterValues { it !in granted }.keys.toList()
                val metrics = mutableSetOf<AggregateMetric<*>>()
                if (READ_STEPS in granted) metrics += StepsRecord.COUNT_TOTAL
                if (READ_TOTAL_CALORIES_BURNED in granted) metrics += TotalCaloriesBurnedRecord.ENERGY_TOTAL
                if (READ_HEART_RATE in granted) metrics += HeartRateRecord.BPM_AVG
                if (READ_SLEEP in granted) metrics += SleepSessionRecord.SLEEP_DURATION_TOTAL

                if (metrics.isEmpty() && READ_BODY_FAT !in granted) {
                    val result = JSObject()
                    result.put("missingMetrics", JSArray(missing))
                    call.reject("A Fitide não tem permissões de leitura no Health Connect.", "HEALTH_PERMISSIONS", null, result)
                    return@launch
                }

                val zone = ZoneId.systemDefault()
                val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
                val end = Instant.now()
                val range = TimeRangeFilter.between(start, end)

                val result = withTimeout(12_000) {
                    val aggregate = if (metrics.isNotEmpty()) {
                        client.aggregate(AggregateRequest(metrics = metrics, timeRangeFilter = range))
                    } else null
                    val bodyFat = if (READ_BODY_FAT in granted) {
                        client.readRecords(
                            ReadRecordsRequest(
                                recordType = BodyFatRecord::class,
                                timeRangeFilter = range,
                                ascendingOrder = false,
                                pageSize = 1,
                            ),
                        ).records.firstOrNull()?.percentage?.value
                    } else null

                    JSObject().apply {
                        aggregate?.get(StepsRecord.COUNT_TOTAL)?.let { put("steps", it) }
                        aggregate?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.let { put("activeCalories", it.inKilocalories) }
                        aggregate?.get(HeartRateRecord.BPM_AVG)?.let { put("averageHeartRate", it) }
                        aggregate?.get(SleepSessionRecord.SLEEP_DURATION_TOTAL)?.let { put("sleepMinutes", it.toMinutes()) }
                        bodyFat?.let { put("bodyFatPercent", it) }
                        put("missingMetrics", JSArray(missing))
                    }
                }
                call.resolve(result)
            } catch (error: kotlinx.coroutines.TimeoutCancellationException) {
                call.reject("O Health Connect não respondeu à leitura nativa.", "HEALTH_TIMEOUT", error)
            } catch (error: SecurityException) {
                call.reject("O Health Connect recusou uma das leituras autorizadas.", "HEALTH_PERMISSIONS", error)
            } catch (error: Exception) {
                call.reject(error.message ?: "Não foi possível ler o Health Connect.", "HEALTH_READ_FAILED", error)
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }
}
