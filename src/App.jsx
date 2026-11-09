import { useExperiment } from './context/ExperimentContext.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import Screen1Participant from './screens/Screen1Participant.jsx';
import Screen2Topic from './screens/Screen2Topic.jsx';
import Screen3Cards from './screens/Screen3Cards.jsx';
import Screen4Reading from './screens/Screen4Reading.jsx';
import Screen5Quiz from './screens/Screen5Quiz.jsx';
import Screen6QuizResult from './screens/Screen6QuizResult.jsx';
import Screen7Keywords from './screens/Screen7Keywords.jsx';
import Screen8Retelling from './screens/Screen8Retelling.jsx';
import Screen9Assessment from './screens/Screen9Assessment.jsx';

const SCREENS = {
  1: Screen1Participant,
  2: Screen2Topic,
  3: Screen3Cards,
  4: Screen4Reading,
  5: Screen5Quiz,
  6: Screen6QuizResult,
  7: Screen7Keywords,
  8: Screen8Retelling,
  9: Screen9Assessment,
};

export default function App() {
  const { state } = useExperiment();
  const Screen = SCREENS[state.screen] || Screen1Participant;
  return (
    <>
      {/* key で画面ごとに再マウント（計測・録音のライフサイクルを画面単位に閉じる） */}
      <Screen key={`${state.screen}-${state.sessionId}`} />
      <LoadingOverlay />
    </>
  );
}
