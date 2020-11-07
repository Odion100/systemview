import SystemViewer from "./pages/SystemViewer/SystemViewer";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.css";

const App = ({ SystemView }) => {
  return (
    <Router>
      <div className="App">
        <Switch>
          <Route
            exact
            path="/"
            render={(props) => <SystemViewer {...props} SystemView={SystemView} />}
          />
        </Switch>
      </div>
    </Router>
  );
};

export default App;
