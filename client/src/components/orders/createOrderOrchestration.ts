export type CreateOrderStage =
  | 'editing'
  | 'creating-draft'
  | 'draft-created'
  | 'submitting'
  | 'success'
  | 'submit-failed';

interface CreateAndSubmitOptions<TDraft, TResult> {
  draft: TDraft | null;
  createDraft: () => Promise<TDraft>;
  submitDraft: (draft: TDraft) => Promise<TResult>;
  onDraftCreated: (draft: TDraft) => void;
  onStageChange: (stage: CreateOrderStage) => void;
}

export class DraftSubmitError<TDraft> extends Error {
  readonly draft: TDraft;
  readonly cause: unknown;

  constructor(draft: TDraft, cause: unknown) {
    super('Order draft was created but could not be submitted.');
    this.name = 'DraftSubmitError';
    this.draft = draft;
    this.cause = cause;
  }
}

/**
 * Coordinates the existing create and submit endpoints without claiming
 * transaction semantics across the two HTTP requests.
 */
export const createAndSubmitOrder = async <TDraft, TResult>({
  draft,
  createDraft,
  submitDraft,
  onDraftCreated,
  onStageChange,
}: CreateAndSubmitOptions<TDraft, TResult>): Promise<TResult> => {
  let persistedDraft = draft;

  if (!persistedDraft) {
    onStageChange('creating-draft');
    persistedDraft = await createDraft();
    onDraftCreated(persistedDraft);
    onStageChange('draft-created');
  }

  onStageChange('submitting');
  try {
    const result = await submitDraft(persistedDraft);
    onStageChange('success');
    return result;
  } catch (error) {
    onStageChange('submit-failed');
    throw new DraftSubmitError(persistedDraft, error);
  }
};
