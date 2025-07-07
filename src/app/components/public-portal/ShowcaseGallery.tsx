import React, { ReactNode } from 'react'

interface ShowcaseGalleryProps {
  showcases: any[]
  children: ReactNode
}

const ShowcaseGallery: React.FC<ShowcaseGalleryProps> = ({ showcases, children }) => {
  return (
    <div className="row g-4">
      {React.Children.map(children, (child, index) => (
        <div key={index} className="col-12 col-md-6 col-lg-4">
          {child}
        </div>
      ))}
    </div>
  )
}

export default ShowcaseGallery