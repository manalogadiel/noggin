export interface ConceptCheck {
  inAnswer: boolean;
  inPages: boolean;
  consistentWithReference: boolean;
}

export function isConceptCovered(concept: ConceptCheck): boolean {
  return (
    concept.inAnswer &&
    concept.inPages &&
    concept.consistentWithReference
  );
}

export function isQuestionCorrect(
  concepts: ReadonlyArray<ConceptCheck>,
): boolean {
  if (concepts.length === 0) {
    return false;
  }
  return concepts.every(isConceptCovered);
}
