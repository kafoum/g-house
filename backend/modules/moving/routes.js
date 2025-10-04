const express = require('express');
const auth = require('../../middleware/auth');
const { validate } = require('../../validation/validate');
const { createMoveSchema, listMovesQuery, scheduleMoveSchema } = require('./schemas');
const { createMove, listMoves, getMove, scheduleMove, startMove, completeMove, cancelMove } = require('./controller');

const router = express.Router();

router.post('/', auth, validate({ body: createMoveSchema }), createMove);
router.get('/', auth, validate({ query: listMovesQuery }), listMoves);
router.get('/:id', auth, getMove);
router.post('/:id/schedule', auth, validate({ body: scheduleMoveSchema }), scheduleMove);
router.post('/:id/start', auth, startMove);
router.post('/:id/complete', auth, completeMove);
router.post('/:id/cancel', auth, cancelMove);

module.exports = router;
