export default {
  scope: "stt",
  name: "framework-modular",
  taxonomy: "project",

  sst: {
    app: "framework-modular",
  },

  sdk: {
    version: "0.23.11",
    packages: [],
  },

  devlink: {
    modes: {
      default: "dev",
      dev: () => ({ manager: "store" }),
    },
  },
};
