# object-graph-as-json

Given an arbitrary javascript object, this library encodes it using only JSON-safe data types.
Tools for decoding the data are provided too.

This enables serializing/deserializing objects that `JSON.stringify` cannot handle.

Goals:

1. Support encoding circular / cyclic references among objects.
2. Preserve as much detail as feasible about every type of javascript object.
    - Even if decoding to an equivalent object will be impossible, consumers should still be able to access as much information as possible about what the original object was like.
3. Be safe for automated tooling to inject at arbitrary points in a program without changing the program's behavior.
    - Therefore, property getters will not be called unless they are built-in parts of javascript that do not have side effects.
      (But the existence of the getter, and its function object, will be encoded.)
4. If desired, encode information about an object's identity.
    - Enables determining whether two encoded objects (whether they are otherwise identical or not) originated from the same in-memory object or not.
