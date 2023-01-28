export const SystemViewModule = (specs) =>
  function SystemView() {
    console.log(specs);
    this.saveDoc = (data) => data;
    this.getDoc = (data) => data;
  };
