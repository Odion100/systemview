import Argument from "../FullTest/components/Argument.class";
import Test from "../FullTest/components/Test.class";

export default function transformTest(savedTests, connectedServices) {
  return savedTests.map(({ Before, Main, Events, After, title, namespace }) => {
    const FullTest = [Before, Main, Events, After];
    return {
      Before: Before.map((test) =>
        new Test({
          ...test,
          args: test.args.map((arg) => new Argument(arg, FullTest)),
        }).getConnection(connectedServices)
      ),
      Main: Main.map((test) =>
        new Test({
          ...test,
          args: test.args.map((arg) => new Argument(arg, FullTest)),
        }).getConnection(connectedServices)
      ),
      Events: Events.map((test) =>
        new Test({
          ...test,
          args: test.args.map((arg) => new Argument(arg, FullTest)),
        }).getConnection(connectedServices)
      ),
      After: After.map((test) =>
        new Test({
          ...test,
          args: test.args.map((arg) => new Argument(arg, FullTest)),
        }).getConnection(connectedServices)
      ),
      title,
      namespace,
    };
  });
}
