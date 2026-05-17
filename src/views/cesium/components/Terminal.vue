<template>
  <div class="bg-main">
    <div
      ref="terminal"
      v-loading="loading"
      class="terminal"
      element-loading-text="拼命连接中"
      @click="handleTerminalClick"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, watch } from 'vue'
import { debounce } from 'lodash'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

const props = defineProps({
  wsUrl: {
    type: String,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  },
  terminalSize: {
    type: Object,
    default: () => ({ width: '600px', height: '400px' })
  }
})

const terminal = ref(null)
const fitAddon = new FitAddon()

let loading = ref(true)
let first = ref(true)
let terminalSocket = ref(null)
let term = ref(null)

const createWS = () => {
  if (!props.wsUrl) {
    console.error('WebSocket URL 未提供')
    return
  }
  
  terminalSocket.value = new WebSocket(props.wsUrl)

  terminalSocket.value.onopen = () => {
    loading.value = false
    setTimeout(() => {
      fitAddon.fit()
    }, 50)
  }

  terminalSocket.value.onmessage = onWSReceive
  terminalSocket.value.onclose = () => console.log("WS Closed")

  terminalSocket.value.onerror = (ex) => {
    const message = ex.message || "disconnected"
    term.value?.write(`\x1b[31m${message}\x1b[m\r\n`)
  }
}

const reconnectWS = () => {
  if (terminalSocket.value) {
    terminalSocket.value.close()
  }
  createWS()
}

watch(() => props.wsUrl, (newUrl) => {
  if (newUrl) {
    reconnectWS()
  }
})

watch(() => props.visible, (visible) => {
  if (visible && props.wsUrl) {
    if (terminalSocket.value?.readyState === WebSocket.CLOSED) {
      reconnectWS()
    }

    setTimeout(() => {
      fitAddon.fit()
    }, 50)
  }
})

watch(() => props.terminalSize, (newSize) => {
  if (term.value && newSize) {
    const width = parseInt(newSize.width);
    const height = parseInt(newSize.height);

    let fontSize = 14;

    if (width < 400) {
      fontSize = 12;
    } else if (width < 500) {
      fontSize = 13;
    } else if (width > 800) {
      fontSize = 16;
    } else if (width > 1000) {
      fontSize = 18;
    }

    if (height < 300) {
      fontSize = Math.max(fontSize - 1, 10);
    } else if (height > 600) {
      fontSize = Math.min(fontSize + 1, 20);
    }

    if (term.value.options.fontSize !== fontSize) {
      term.value.options.fontSize = fontSize;

      setTimeout(() => {
        fitAddon.fit()
      }, 50);
    }
  }
}, { deep: true })

const initTerm = () => {
  term.value = new Terminal({
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 0,
    windowsMode:true,
    cursorBlink: true,
    cursorStyle: 'block',
    theme: {
      background: '#181d28',
      foreground: '#ffffff',
    },
  })
  term.value.loadAddon(fitAddon)
  term.value.open(terminal.value)

  setTimeout(() => {
    fitAddon.fit()
  }, 50)

  term.value.onData((data) => {
    if (isWsOpen()) {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      const base64 = btoa(String.fromCharCode(...bytes));
      terminalSocket.value.send(
        JSON.stringify({
          type: 'terminal',
          data: {
            base64,
          },
        })
      )
    }
  })

  term.value.onResize(() => {
    resizeRemoteTerminal()
  })
}

const onWSReceive = (message) => {
  if (first.value === true) {
    first.value = false
    resizeRemoteTerminal()
  }

  try {
    const data = JSON.parse(message.data)
    if (data.type === 'output') {
      const binaryStr = atob(data.output);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const decoded = new TextDecoder('utf-8').decode(bytes);
      term.value.write(decoded);
    }
  } catch (err) {
    console.error('❌ 解析 message.data 出错:', err)
  }

}

const handleTerminalClick = () => {
  if (term.value && term.value.element) {
    term.value.focus()
  }
}

const resizeRemoteTerminal = () => {
  const { cols, rows } = term.value
  if (isWsOpen()) {
    terminalSocket.value.send(
      JSON.stringify({
        type: 'resize',
        data: { cols, rows },
      })
    )
  }
}

const isWsOpen = () => terminalSocket.value?.readyState === 1

const onResize = debounce(() => {
  fitAddon.fit()
}, 500)

const onTerminalResize = () => {
  window.addEventListener('resize', onResize)
}

const removeResizeListener = () => {
  window.removeEventListener('resize', onResize)
}

onMounted(() => {
  if (props.wsUrl) {
    createWS()
  }
  initTerm()
  onTerminalResize()
})

onBeforeUnmount(() => {
  removeResizeListener()
  terminalSocket.value?.close()
})
</script>

<style lang="scss" scoped>
.bg-main {
  height: 100%;
  width: 100%;
  background-color: #181d28;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  overflow: hidden;
}

.terminal {
  width: 100%;
  height: 100%;
  min-height: 280px;
  text-align: left;
  white-space: pre;
  background-color: #181d28;
  padding: 4px;
  box-sizing: border-box;
}

.xterm {
  background-color: #181d28 !important;
  font-family: 'Consolas', 'Menlo', monospace !important;
  letter-spacing: 0 !important;
  line-height: 1.2;
  text-align: left;
}

:deep(.xterm-viewport) {
  overflow-y: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 6px;
}

:deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(255, 255, 255, 0.3);
}
</style>