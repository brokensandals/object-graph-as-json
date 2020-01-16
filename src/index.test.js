import { Encoder, UnsafeDecoder } from './';

test('sample usage', () => {
  // Sample object
  const counter = {
    current: 1,
    increment() {
      this.current++;
    }
  };
  counter.increment();

  expect(counter.current).toEqual(2);
  
  // Encoding
  const encoder = new Encoder();
  const encoded = encoder.encode(counter);
  expect(encoded).toMatchSnapshot();

  // The encoded object can be serialized and deserialized to JSON if desired
  const serialized = JSON.stringify(encoded);
  const deserialized = JSON.parse(serialized);

  // Decoding
  const decoder = new UnsafeDecoder();
  const decoded = decoder.decode(deserialized);
  expect(decoded.current).toEqual(2);
  decoded.increment();
  expect(decoded.current).toEqual(3);
});