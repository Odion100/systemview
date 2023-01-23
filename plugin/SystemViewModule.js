export const SystemViewModule = (specs) =>
  function SystemView() {
    console.log(specs);
    this.saveSpecs = (data) => data;
    this.getSpecs = (data) => data;
  };
