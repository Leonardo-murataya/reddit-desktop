import React, { useState, useEffect } from 'react';

export default function AwardPickerModal({ selectedAwards = [], onSave, onClose }) {
  const [catalog, setCatalog] = useState([]);
  const [currentSelection, setCurrentSelection] = useState(selectedAwards);

  useEffect(() => {
    fetch('/assets/awards/catalog.json')
      .then(res => res.json())
      .then(data => setCatalog(data))
      .catch(err => console.error('Error cargando catálogo de awards:', err));
  }, []);

  const isSelected = (id) => {
    return currentSelection.some(item => item.id === id);
  };

  const handleToggleSelect = (item) => {
    setCurrentSelection(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, { id: item.id, name: item.name, file: item.file, isAnimated: item.isAnimated, count: 1 }];
      }
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: '16px',
        width: '100%', maxWidth: '760px',
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
        color: '#f4f4f5',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #27272a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#fff' }}>
              🎖️ Catálogo de Medallas de Reddit
            </h3>
            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
              Haz clic en cualquier medalla para agregarla o quitarla de tu tarjeta
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#a1a1aa', fontSize: '22px', cursor: 'pointer', padding: '4px'
          }}>✕</button>
        </div>

        {/* Grid Único de Medallas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: '12px' }}>
          {catalog.map(item => {
            const active = isSelected(item.id);
            return (
              <div
                key={item.id}
                onClick={() => handleToggleSelect(item)}
                style={{
                  backgroundColor: active ? '#1e1b4b' : '#27272a',
                  border: active ? '2px solid #6366f1' : '1px solid #3f3f46',
                  borderRadius: '12px',
                  padding: '14px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  position: 'relative',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none'
                }}
              >
                {/* Badge de Selección (✓) */}
                {active && (
                  <div style={{
                    position: 'absolute', top: '6px', right: '6px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    backgroundColor: '#6366f1', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 'bold'
                  }}>
                    ✓
                  </div>
                )}

                <img
                  src={`/assets/awards/${item.file}`}
                  alt={item.name}
                  style={{ width: '52px', height: '52px', objectFit: 'contain' }}
                />
                <span style={{
                  fontSize: '11px', textAlign: 'center',
                  color: active ? '#60a5fa' : '#e4e4e7',
                  fontWeight: active ? '700' : '500',
                  height: '28px', overflow: 'hidden'
                }}>
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer con Resumen y Guardar */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #27272a',
          backgroundColor: '#09090b',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '13px', color: '#a1a1aa' }}>
            Seleccionadas: <strong style={{ color: '#38bdf8' }}>{currentSelection.length} medallas</strong>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: '1px solid #3f3f46',
                backgroundColor: 'transparent', color: '#e4e4e7', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onSave(currentSelection);
                onClose();
              }}
              style={{
                padding: '10px 22px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff',
                fontWeight: '600', cursor: 'pointer', fontSize: '13px',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              Guardar Medallas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
