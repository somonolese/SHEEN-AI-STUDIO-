// IzzyOnDroid uses the same F-Droid index-v1.json format as the official repo.
// We reuse the F-Droid adapter with a different base URL and priority.

import { FdroidRepository } from './FdroidRepository';

export class IzzyRepository extends FdroidRepository {}
