import SystemViewer from "./pages/SystemViewer/SystemViewer";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.css";

const App = ({ SystemViewAPI }) => {
  return (
    <Router>
      <div className="App">
        <Switch>
          <Route
            exact
            path="/"
            render={(props) => <SystemViewer {...props} SystemViewAPI={SystemViewAPI} />}
          />
        </Switch>
      </div>
    </Router>
  );
};

export default App;
