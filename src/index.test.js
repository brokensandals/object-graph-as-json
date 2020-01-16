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

test('one of the reasons UnsafeDecoder is unsafe', () => {
  expect(Object.EVIL_THING_HAPPENED).toBeUndefined();

  const maliciousInput = {
    type: 'function',
    id: '1',
    // Normally, a function's source would start with something like
    // function(). Because this doesn't, the malicious code gets execute
    // as soon as we try to decode the input, even if we never try
    // to call the decoded function.
    source: 'Object.EVIL_THING_HAPPENED = true'
  };

  new UnsafeDecoder().decode(maliciousInput);

  expect(Object.EVIL_THING_HAPPENED).toBeTruthy();
});
