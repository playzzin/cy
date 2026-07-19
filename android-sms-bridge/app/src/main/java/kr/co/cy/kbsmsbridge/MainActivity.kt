package kr.co.cy.kbsmsbridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.text.DateFormat
import java.util.Date

class MainActivity : Activity() {
    private lateinit var configRepository: BridgeConfigRepository
    private lateinit var statusRepository: BridgeStatusRepository
    private lateinit var endpointInput: EditText
    private lateinit var allowedSendersInput: EditText
    private lateinit var secretInput: EditText
    private lateinit var deviceIdView: TextView
    private lateinit var statusView: TextView
    private lateinit var permissionButton: Button

    private val handler = Handler(Looper.getMainLooper())
    private val refreshTask = object : Runnable {
        override fun run() {
            refreshStatus()
            handler.postDelayed(this, STATUS_REFRESH_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        configRepository = BridgeConfigRepository(this)
        statusRepository = BridgeStatusRepository(this)
        setContentView(buildContent())
        loadConfiguration()
        recoverQueuedWork()
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(refreshTask)
        handler.post(refreshTask)
    }

    override fun onPause() {
        handler.removeCallbacks(refreshTask)
        super.onPause()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_RECEIVE_SMS) {
            val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
            toast(if (granted) "문자 수신 권한이 허용되었습니다." else "권한이 없으면 문자를 받을 수 없습니다.")
            refreshStatus()
        }
    }

    private fun buildContent(): View {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(40))
            setBackgroundColor(Color.rgb(255, 253, 247))
        }

        content.addView(text("국민은행 SMS 브리지", 24f, Typeface.BOLD).apply {
            setTextColor(Color.rgb(75, 63, 42))
        })
        content.addView(text("전용 안드로이드폰에서 허용된 은행 문자만 회사 서버로 안전하게 전달합니다.", 14f).apply {
            setTextColor(Color.DKGRAY)
        }, blockParams(top = 8, bottom = 20))

        content.addView(sectionTitle("1. 문자 권한"))
        permissionButton = button("문자 수신 권한 허용") {
            requestSmsPermission()
        }
        content.addView(permissionButton, blockParams(bottom = 22))

        content.addView(sectionTitle("2. 서버 설정"))
        content.addView(label("Firebase HTTPS 수신 주소"))
        endpointInput = editText(
            hint = "https://asia-northeast3-...cloudfunctions.net/ingestBankSms",
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI,
        )
        content.addView(endpointInput, blockParams(bottom = 12))

        content.addView(label("허용 발신번호 또는 발신자명 (쉼표/줄바꿈 구분)"))
        allowedSendersInput = editText(
            hint = "15889999, KB국민은행",
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE,
        ).apply {
            minLines = 2
            maxLines = 4
        }
        content.addView(allowedSendersInput, blockParams(bottom = 12))

        content.addView(label("공유 비밀키 (32바이트 이상)"))
        secretInput = editText(
            hint = "기존 비밀키를 유지하려면 비워 두세요",
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD,
        ).apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            }
        }
        content.addView(secretInput, blockParams(bottom = 12))

        content.addView(button("설정 저장") { saveConfiguration(showConfirmation = true) })
        content.addView(button("서버 연결 테스트") { enqueueConnectionTest() }, blockParams(top = 8))
        content.addView(button("대기 중인 항목 다시 보내기") { retryQueuedItems() }, blockParams(top = 8, bottom = 22))

        content.addView(sectionTitle("3. 기기 및 작동 상태"))
        content.addView(label("기기 ID (서버 등록 시 사용)"))
        deviceIdView = text("-", 13f).apply {
            setTextIsSelectable(true)
            typeface = Typeface.MONOSPACE
        }
        content.addView(deviceIdView, blockParams(bottom = 12))

        statusView = text("상태를 불러오는 중…", 14f).apply {
            setPadding(dp(14), dp(14), dp(14), dp(14))
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                setStroke(dp(1), Color.rgb(220, 211, 190))
                cornerRadius = dp(10).toFloat()
            }
        }
        content.addView(statusView, blockParams(bottom = 16))
        content.addView(text(
            "안정적인 운영을 위해 이 앱의 배터리 사용을 ‘제한 없음’으로 설정하고, 기기를 항상 충전·네트워크 연결 상태로 유지하세요. 재부팅 후에는 WorkManager가 미전송 작업을 복구합니다.",
            12f,
        ).apply { setTextColor(Color.GRAY) })

        return ScrollView(this).apply { addView(content) }
    }

    private fun loadConfiguration() {
        try {
            val config = configRepository.load()
            endpointInput.setText(config.endpoint)
            allowedSendersInput.setText(config.allowedSenders)
            deviceIdView.text = config.deviceId
        } catch (_: Exception) {
            toast("보안 저장소를 열 수 없습니다. 기기 잠금 및 보안 상태를 확인하세요.")
        }
    }

    private fun saveConfiguration(showConfirmation: Boolean): Boolean {
        return try {
            configRepository.save(
                endpoint = endpointInput.text.toString(),
                allowedSenders = allowedSendersInput.text.toString(),
                newSecret = secretInput.text.toString(),
            )
            secretInput.text.clear()
            BridgeScheduler.enqueueAll(this, replaceExisting = true)
            BridgeScheduler.ensureHeartbeat(this)
            if (showConfirmation) toast("설정을 안전하게 저장했습니다.")
            refreshStatus()
            true
        } catch (error: IllegalArgumentException) {
            toast(error.message ?: "입력한 설정을 확인하세요.")
            false
        } catch (_: Exception) {
            toast("설정을 저장하지 못했습니다. 기기 보안을 확인하세요.")
            false
        }
    }

    private fun enqueueConnectionTest() {
        if (!saveConfiguration(showConfirmation = false)) return
        try {
            val config = configRepository.load()
            val envelope = BridgeEnvelope.connectionTest(config.deviceId)
            val queueId = SmsQueueStore(this).enqueue(envelope)
            statusRepository.recordQueued(envelope.eventType, System.currentTimeMillis())
            BridgeScheduler.enqueue(this, queueId)
            toast("연결 테스트를 전송 대기열에 추가했습니다.")
            refreshStatus()
        } catch (_: Exception) {
            toast("연결 테스트를 준비하지 못했습니다.")
        }
    }

    private fun retryQueuedItems() {
        try {
            val count = SmsQueueStore(this).count()
            BridgeScheduler.enqueueAll(this, replaceExisting = true)
            toast(if (count == 0) "대기 중인 항목이 없습니다." else "${count}개 항목의 전송을 요청했습니다.")
        } catch (_: Exception) {
            toast("암호화 대기열을 읽지 못했습니다.")
        }
    }

    private fun requestSmsPermission() {
        if (hasSmsPermission()) {
            toast("문자 수신 권한이 이미 허용되어 있습니다.")
            return
        }
        requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_RECEIVE_SMS)
    }

    private fun recoverQueuedWork() {
        runCatching {
            BridgeScheduler.enqueueAll(this)
            BridgeScheduler.ensureHeartbeat(this)
        }
    }

    private fun refreshStatus() {
        permissionButton.text = if (hasSmsPermission()) {
            "문자 수신 권한 허용됨"
        } else {
            "문자 수신 권한 허용"
        }

        try {
            val config = configRepository.load()
            val status = statusRepository.load()
            val queued = SmsQueueStore(this).count()
            deviceIdView.text = config.deviceId
            statusView.text = buildString {
                appendLine("문자 권한: ${if (hasSmsPermission()) "허용됨" else "필요함"}")
                appendLine("서버 설정: ${if (config.isComplete) "완료" else "미완료"}")
                appendLine("암호화 대기 항목: ${queued}개")
                appendLine("마지막 문자 수신: ${formatTime(status.lastReceivedAt)}")
                appendLine("마지막 전달 성공: ${formatTime(status.lastDeliveredAt)}")
                append("최근 상태: ${status.lastEvent.ifBlank { "기록 없음" }}")
                if (status.lastError.isNotBlank()) {
                    appendLine()
                    append("최근 오류 (${formatTime(status.lastErrorAt)}): ${status.lastError}")
                }
            }
        } catch (_: Exception) {
            statusView.text = "보안 저장소 상태를 확인할 수 없습니다. 기기 잠금 또는 앱 데이터를 확인하세요."
        }
    }

    private fun hasSmsPermission() = checkSelfPermission(Manifest.permission.RECEIVE_SMS) ==
        PackageManager.PERMISSION_GRANTED

    private fun formatTime(timestamp: Long): String = if (timestamp <= 0) {
        "기록 없음"
    } else {
        DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.MEDIUM).format(Date(timestamp))
    }

    private fun sectionTitle(value: String) = text(value, 18f, Typeface.BOLD).apply {
        setTextColor(Color.rgb(75, 63, 42))
    }

    private fun label(value: String) = text(value, 13f, Typeface.BOLD).apply {
        setTextColor(Color.DKGRAY)
    }

    private fun text(value: String, size: Float, style: Int = Typeface.NORMAL) = TextView(this).apply {
        text = value
        textSize = size
        setTypeface(typeface, style)
    }

    private fun editText(hint: String, inputType: Int) = EditText(this).apply {
        this.hint = hint
        this.inputType = inputType
        setTextSize(14f)
        setPadding(dp(12), dp(10), dp(12), dp(10))
        setBackgroundColor(Color.WHITE)
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { action() }
    }

    private fun blockParams(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply {
        topMargin = dp(top)
        bottomMargin = dp(bottom)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    private companion object {
        const val REQUEST_RECEIVE_SMS = 1001
        const val STATUS_REFRESH_MS = 2_000L
    }
}
