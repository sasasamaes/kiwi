import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import newOrderSound from '../../assets/new-order.wav';

let player: AudioPlayer | null = null;

// Best-effort KDS alert. A failing audio pipeline must never break the board,
// so every error is swallowed.
export function playNewOrderAlert() {
  try {
    if (!player) player = createAudioPlayer(newOrderSound);
    player.seekTo(0);
    player.play();
  } catch {
    // ignore: alert audio is a nicety, not a requirement
  }
}
