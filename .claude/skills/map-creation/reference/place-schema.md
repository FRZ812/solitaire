# Region and place schema

The canonical shapes are renderer-neutral and serializable.

```js
{
  id: "whitemarch-basin",
  name: "Whitemarch Basin",
  locations: {
    whitemarch: {
      name: "Whitemarch",
      kind: "capital",
      placeId: "whitemarch",
      routes: ["whitewend-ferry"]
    }
  }
}
```

```js
{
  id: "whitemarch",
  name: "Whitemarch",
  regionId: "whitemarch-basin",
  entryNode: "crown-gate",
  nodes: {
    "crown-gate": {
      name: "Crown Gate",
      kind: "gate",
      exits: ["market-road", "outer-road"],
      services: [],
      encounterPools: [],
      access: "public",
      descriptionKey: "place.whitemarch.crown-gate"
    }
  }
}
```

Required rules:

- ids are unique and stable;
- every exit resolves;
- required nodes are reachable from `entryNode`;
- every place has at least one valid return to its region location;
- service, encounter, faction, art, and text references resolve;
- state-changing access rules use authored rule ids, not prose interpretation;
- structural changes bump a content version and include a save migration.
