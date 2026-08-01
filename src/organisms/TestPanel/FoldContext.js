import { createContext } from "react";

// Lets the scratchpad's top toolbar expand/collapse EVERY section + step at once without threading a
// prop through BeforeTest/MainTest/MultiTestSection/TestContainer. `signal` bumps on each request (so a
// repeat of the same direction still fires); `open` is the target state. Consumers react to `signal`
// changes and set their own open state to `open`. signal 0 = untouched (don't override initial state).
const FoldContext = createContext({ signal: 0, open: true });

export default FoldContext;
