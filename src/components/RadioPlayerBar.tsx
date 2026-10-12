import { useLibrary } from "../library/context";
import { RadioPlayerBarView } from "./RadioPlayerBarView";
/** Live radio releases the stream on pause and rejoins the current broadcast on resume. */
export function RadioPlayerBar() {
  const radio = useLibrary().radio;
  return (
    <RadioPlayerBarView
      station={radio.station()}
      status={radio.status()}
      error={radio.error()}
      volume={radio.volume()}
      onPause={radio.pause}
      onResume={() => void radio.resume()}
      onStop={radio.stop}
      onMute={radio.mute}
      onVolume={radio.changeVolume}
    />
  );
}
