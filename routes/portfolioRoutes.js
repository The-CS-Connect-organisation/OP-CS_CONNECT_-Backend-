import { Router } from 'express';
import pkgMulter from 'multer';
const multer = pkgMulter.default || pkgMulter;
import {
  createPortfolio,
  getPortfolio,
  updatePortfolio,
  addPortfolioItem,
  getPortfolioItems,
  deletePortfolioItem,
  exportPortfolio,
} from '../controllers/portfolioController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createPortfolioSchema, updatePortfolioSchema } from '../validators/portfolioValidators.js';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.use(requireAuth);

// Create portfolio
router.post('/', validateRequest(createPortfolioSchema), createPortfolio);

// Get portfolio (self or own students)
router.get('/:studentId?', allowRoles('student', 'parent', 'teacher', 'admin', 'manager'), getPortfolio);

// Update portfolio
router.put('/:portfolioId', validateRequest(updatePortfolioSchema), updatePortfolio);

// Add item (work sample, certificate, etc.)
router.post(
  '/:portfolioId/items',
  upload.single('file'),
  addPortfolioItem
);

// Get portfolio items
router.get(
  '/:portfolioId/items',
  getPortfolioItems
);

// Delete portfolio item
router.delete(
  '/:portfolioId/items/:itemId',
  deletePortfolioItem
);

// Export portfolio
router.get(
  '/:portfolioId/export',
  allowRoles('student', 'parent', 'teacher', 'admin'),
  exportPortfolio
);

export default router;