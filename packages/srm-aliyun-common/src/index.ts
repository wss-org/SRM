

export const tracker = () =>
  (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const result = await original.call(this, ...args);
      return result;
    };
  };
