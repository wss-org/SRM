

export const tracker = () =>
  (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      console.log("pre update-----", args);
      const result = await original.call(this, ...args);
      console.log("post update-----");
      return result;
    };
  };
