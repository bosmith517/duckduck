import React from 'react'

interface FilterState {
  category: string
  search: string
  tags: string[]
  sortBy: 'recent' | 'popular' | 'duration'
}

interface ShowcaseFiltersProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  categories: string[]
  tags: string[]
}

const ShowcaseFilters: React.FC<ShowcaseFiltersProps> = ({ 
  filters, 
  onFilterChange, 
  categories,
  tags 
}) => {
  const handleCategoryChange = (category: string) => {
    onFilterChange({ ...filters, category })
  }

  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filters, search })
  }

  const handleSortChange = (sortBy: 'recent' | 'popular' | 'duration') => {
    onFilterChange({ ...filters, sortBy })
  }

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag]
    onFilterChange({ ...filters, tags: newTags })
  }

  return (
    <div className="showcase-filters">
      <div className="row g-4">
        {/* Search */}
        <div className="col-lg-4">
          <div className="position-relative">
            <input
              type="text"
              className="form-control form-control-solid ps-12"
              placeholder="Search projects..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <span className="position-absolute top-50 start-0 translate-middle-y ms-4">
              <i className="ki-duotone ki-magnifier fs-3 text-gray-500">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </span>
          </div>
        </div>

        {/* Category Filter */}
        <div className="col-lg-3">
          <select 
            className="form-select form-select-solid"
            value={filters.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div className="col-lg-3">
          <select 
            className="form-select form-select-solid"
            value={filters.sortBy}
            onChange={(e) => handleSortChange(e.target.value as any)}
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="duration">Completion Time</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div className="col-lg-2">
          <button 
            className="btn btn-light-primary w-100"
            onClick={() => onFilterChange({
              category: 'all',
              search: '',
              tags: [],
              sortBy: 'recent'
            })}
            disabled={filters.category === 'all' && !filters.search && filters.tags.length === 0}
          >
            <i className="ki-duotone ki-filter-remove fs-4 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Clear
          </button>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-4">
          <div className="d-flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                className={`btn btn-sm ${
                  filters.tags.includes(tag) ? 'btn-primary' : 'btn-light-primary'
                }`}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ShowcaseFilters