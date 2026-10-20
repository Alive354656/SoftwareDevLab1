export interface AttributeData {
  readonly name: string;
  readonly value: string;
}

export class ElementData {
  constructor(
    readonly tag: string,
    readonly attributes: readonly AttributeData[],
    readonly text: string,
    readonly children: readonly ElementData[],
  ) {}

  attribute(name: string): string | undefined {
    for (const attribute of this.attributes) {
      if (attribute.name === name) {
        return attribute.value;
      }
    }
    return undefined;
  }
}
