// Proximity voice chat: real WebRTC peer-to-peer audio, signaled over the existing
// Socket.IO connection, using only free public STUN (no TURN). That means it works
// for most home/office networks but a peer behind a strict symmetric NAT may fail
// to connect directly - a known limitation of skipping paid TURN infrastructure,
// not a bug. Mesh topology (who should be connected to whom) is server-decided
// (see Game.js#_recomputeVoiceGroups) and pushed to clients as a full peer list;
// each client diffs that against its own open connections and self-heals.
const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
const MAX_HEARING_RANGE = 420;

const Voice = {
  enabled: false,
  localStream: null,
  peers: new Map(), // peerId -> RTCPeerConnection
  audioEls: new Map(), // peerId -> <audio>

  init() {
    Net.on("voice:peers", ({ peers }) => this._syncPeers(peers));
    Net.on("voice:signal", ({ from, data }) => this._handleSignal(from, data));

    const btn = document.getElementById("btn-mic");
    btn.onclick = () => (this.enabled ? this.disable() : this.enable());
    this._volumeLoop();
  },

  async enable() {
    if (!App.settings || App.settings.voiceChatEnabled === false) {
      return HUD.toast("Voice chat is off for this match.");
    }
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      return HUD.toast("Voice chat isn't supported in this browser.");
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return HUD.toast("Microphone permission denied.");
    }
    this.enabled = true;
    this._updateMicButton();
    Net.emit("voice:ready", {}, (res) => {
      if (res && res.error) { this.disable(); HUD.toast(res.error); }
    });
  },

  disable() {
    this.enabled = false;
    this._updateMicButton();
    Net.emit("voice:leave");
    for (const id of [...this.peers.keys()]) this._closePeer(id);
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  },

  _updateMicButton() {
    const btn = document.getElementById("btn-mic");
    btn.classList.toggle("on", this.enabled);
    btn.innerHTML = this.enabled ? "&#x1F3A4; On" : "&#x1F3A4; Off";
  },

  _syncPeers(peerIds) {
    const desired = new Set(peerIds);
    for (const id of peerIds) if (!this.peers.has(id)) this._connectTo(id);
    for (const id of [...this.peers.keys()]) if (!desired.has(id)) this._closePeer(id);
  },

  _createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream);
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) Net.emit("voice:signal", { to: peerId, data: { type: "ice", candidate: e.candidate } });
    };
    pc.ontrack = (e) => this._attachRemoteStream(peerId, e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) this._closePeer(peerId);
    };
    return pc;
  },

  _connectTo(peerId) {
    const pc = this._createPeerConnection(peerId);
    this.peers.set(peerId, pc);
    // Deterministic initiator so both sides agree without a race.
    if (App.myId < peerId) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer).then(() => offer))
        .then((offer) => Net.emit("voice:signal", { to: peerId, data: { type: "offer", sdp: offer } }))
        .catch(() => {});
    }
  },

  async _handleSignal(from, data) {
    let pc = this.peers.get(from);
    if (!pc) {
      pc = this._createPeerConnection(from);
      this.peers.set(from, pc);
    }
    try {
      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        Net.emit("voice:signal", { to: from, data: { type: "answer", sdp: answer } });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === "ice") {
        await pc.addIceCandidate(data.candidate);
      }
    } catch (e) { /* a stale/late signal after a peer closed - harmless */ }
  },

  _attachRemoteStream(peerId, stream) {
    let audio = this.audioEls.get(peerId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.dataset.peerId = peerId;
      document.body.appendChild(audio);
      this.audioEls.set(peerId, audio);
    }
    audio.srcObject = stream;
  },

  _closePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) pc.close();
    this.peers.delete(peerId);
    const audio = this.audioEls.get(peerId);
    if (audio) { audio.srcObject = null; audio.remove(); this.audioEls.delete(peerId); }
  },

  // Distance-based volume during gameplay; full volume during meetings (mesh
  // membership itself doesn't change between the two - only the gain policy does).
  _volumeLoop() {
    requestAnimationFrame(() => this._volumeLoop());
    if (!this.enabled || this.audioEls.size === 0) return;

    if (App.current === "meeting") {
      for (const audio of this.audioEls.values()) audio.volume = 1;
      return;
    }
    if (App.current !== "game" || !App.gameState) return;
    const me = App.gameState.players.find((p) => p.id === App.myId);
    if (!me) return;
    for (const [peerId, audio] of this.audioEls.entries()) {
      const p = App.gameState.players.find((x) => x.id === peerId);
      if (!p) { audio.volume = 0; continue; }
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      audio.volume = Math.max(0, Math.min(1, 1 - d / MAX_HEARING_RANGE));
    }
  },
};

window.addEventListener("DOMContentLoaded", () => Voice.init());
