/**
 * Collaborative markdown editor component for Alpine.js.
 *
 * Usage in template:
 *   <div x-data="markshare.editorComponent('{{ doc_id }}', '{{ ws_scheme }}')" x-init="init()">
 */

window.markshare = window.markshare || {};

window.markshare.editorComponent = function (docId, wsScheme) {
  return {
    content: "",
    preview: "",
    isConnected: false,
    members: [],
    _socket: null,
    _saveTimer: null,
    _DEBOUNCE_MS: 400,

    init() {
      const ta = document.getElementById("editor-textarea");
      this.content = ta ? ta.value : "";
      this.updatePreview();
      this._connect(docId, wsScheme);
    },

    _connect(docId, wsScheme) {
      const url = `${wsScheme}://${window.location.host}/ws/document/${docId}/`;
      const socket = new WebSocket(url);

      socket.onopen = () => {
        this.isConnected = true;
        this._socket = socket;
      };

      socket.onclose = () => {
        this.isConnected = false;
        this._socket = null;
        setTimeout(() => this._connect(docId, wsScheme), 3000);
      };

      socket.onerror = () => {
        this.isConnected = false;
      };

      socket.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (msg.type === "content") {
          this._receiveContent(msg.content);
        } else if (msg.type === "presence") {
          this.members = msg.members;
        }
      };
    },

    onInput(evt) {
      this.content = evt.target.value;
      this.updatePreview();
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this._sendContent(), this._DEBOUNCE_MS);
    },

    _sendContent() {
      if (this._socket?.readyState === WebSocket.OPEN) {
        this._socket.send(JSON.stringify({ type: "content", content: this.content }));
      }
    },

    _receiveContent(incoming) {
      if (this.content === incoming) return;
      const ta = document.getElementById("editor-textarea");
      const selStart = ta?.selectionStart ?? 0;
      const selEnd = ta?.selectionEnd ?? 0;
      this.content = incoming;
      this.updatePreview();
      this.$nextTick(() => {
        if (ta && document.activeElement === ta) {
          const clamped = (pos) => Math.min(pos, incoming.length);
          ta.setSelectionRange(clamped(selStart), clamped(selEnd));
        }
      });
    },

    updatePreview() {
      if (window.marked) {
        this.preview = window.marked.parse(this.content, { breaks: true });
      }
    },
  };
};
