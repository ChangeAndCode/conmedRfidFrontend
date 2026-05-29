import { useEffect, useState } from 'react';
import type { ResponsibleArea } from '../types/Responsible';

interface ResponsibleFormModalProps {
  isOpen: boolean;
  title: string;
  initialName?: string;
  initialArea?: ResponsibleArea;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    area: ResponsibleArea;
  }) => void;
}

export default function ResponsibleFormModal({
  isOpen,
  title,
  initialName = '',
  initialArea = 'manufactura',
  isSubmitting = false,
  onClose,
  onSubmit,
}: ResponsibleFormModalProps) {
  const [name, setName] = useState(initialName);
  const [area, setArea] = useState<ResponsibleArea>(initialArea);

  useEffect(() => {
    setName(initialName);
    setArea(initialArea);
  }, [initialName, initialArea, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <section
      className='adminModalOverlay'
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        className='adminModalCard adminCatalogModalCard'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='adminModalHeader'>  
        <div className='adminModalTitleBlock'>
          <h2>{title}</h2>
          <p>Actualiza la información del responsable.</p>
        </div>
        </div>
  
        <div className='adminForm'>
          <div className='adminFormGrid'>  
          <label className='adminField'>
            <span>Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='Nombre del responsable'
              disabled={isSubmitting}
            />
          </label>

          <label className='adminField'>
            <span>Área</span>
            <select
              value={area}
              onChange={(event) =>
                setArea(event.target.value as ResponsibleArea)
              }
              disabled={isSubmitting}
            >
              <option value='manufactura'>Manufactura</option>
              <option value='calidad'>Calidad</option>
            </select>
          </label>
          </div>
  
          <div className='adminModalFooter'>
            <button  
            className='adminPrimaryButton adminSecondaryButton'
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
            </button>
  
            <button
              className='adminPrimaryButton'
              type='button'
              disabled={isSubmitting || !name.trim()}
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  area,
                })
              }
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}