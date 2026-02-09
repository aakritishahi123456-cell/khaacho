/**
 * Pagination Utility
 * Provides consistent pagination across all list queries
 */

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @returns {Object} Pagination parameters
 */
function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

/**
 * Parse sorting parameters from request query
 * @param {Object} query - Express request query object
 * @param {string} defaultSort - Default sort field
 * @param {string} defaultOrder - Default sort order ('asc' or 'desc')
 * @returns {Object} Sort parameters for Prisma
 */
function parseSortParams(query, defaultSort = 'createdAt', defaultOrder = 'desc') {
  const sortBy = query.sortBy || defaultSort;
  const sortOrder = (query.sortOrder || defaultOrder).toLowerCase();

  return {
    [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
  };
}

/**
 * Build pagination metadata
 * @param {number} total - Total count of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
}

/**
 * Create paginated response
 * @param {Array} data - Array of items
 * @param {number} total - Total count of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Paginated response object
 */
function createPaginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Execute paginated query with Prisma
 * @param {Object} model - Prisma model
 * @param {Object} options - Query options
 * @param {Object} options.where - Where clause
 * @param {Object} options.orderBy - Order by clause
 * @param {Object} options.include - Include relations
 * @param {Object} options.select - Select fields
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @returns {Promise<Object>} Paginated result
 */
async function executePaginatedQuery(model, options = {}) {
  const { where = {}, orderBy, include, select, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      include,
      select,
      skip,
      take: limit,
    }),
    model.count({ where }),
  ]);

  return createPaginatedResponse(data, total, page, limit);
}

/**
 * Cursor-based pagination for large datasets
 * @param {Object} model - Prisma model
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Cursor-paginated result
 */
async function executeCursorPagination(model, options = {}) {
  const {
    where = {},
    orderBy,
    include,
    select,
    cursor,
    limit = 20,
    cursorField = 'id',
  } = options;

  const items = await model.findMany({
    where,
    orderBy,
    include,
    select,
    take: limit + 1, // Fetch one extra to check if there's a next page
    ...(cursor && {
      cursor: { [cursorField]: cursor },
      skip: 1, // Skip the cursor itself
    }),
  });

  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, -1) : items;
  const nextCursor = hasNextPage ? data[data.length - 1][cursorField] : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasNextPage,
      limit,
    },
  };
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @throws {Error} If parameters are invalid
 */
function validatePaginationParams(page, limit) {
  if (page < 1) {
    throw new Error('Page number must be greater than 0');
  }
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }
}

module.exports = {
  parsePaginationParams,
  parseSortParams,
  buildPaginationMeta,
  createPaginatedResponse,
  executePaginatedQuery,
  executeCursorPagination,
  validatePaginationParams,
};
