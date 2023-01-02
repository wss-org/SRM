export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const update =
  ({
    condition,
    action,
  }: {
    condition: () => boolean | Promise<boolean>;
    action?: () => Promise<any>;
  }) =>
  (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    console.log("update decr ===");
    const original = descriptor.value;
    descriptor.value = async function (...args) {
      await sleep(20);
      console.log("pre update-----");
      const result = await original.call(this, ...args);
      console.log("post update-----");
      return "result";
    };
  };
