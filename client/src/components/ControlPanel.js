import React from 'react';
import './ControlPanel.css';

const JOINT_LABELS = ['Base (J1)', 'Shoulder (J2)', 'Elbow (J3)', 'Wrist 1 (J4)', 'Wrist 2 (J5)', 'Wrist 3 (J6)'];

export default function ControlPanel({
  selectedRobot,
  setSelectedRobot,
  jointAngles,
  setJointAngles,
  kawasakiAngles,
  setKawasakiAngles,
  railPosition,
  setRailPosition,
  agvRailPosition,
  setAgvRailPosition,
  animate,
  setAnimate,
  animationSpeed,
  setAnimationSpeed,
  gripperOpen,
  setGripperOpen,
  showEnvironment,
  setShowEnvironment,
}) {
  const isUR10e = selectedRobot === 'ur10e';
  const angles = isUR10e ? jointAngles : kawasakiAngles;
  const setAngles = isUR10e ? setJointAngles : setKawasakiAngles;
  const railValue = isUR10e ? railPosition : agvRailPosition;
  const setRailValue = isUR10e ? setRailPosition : setAgvRailPosition;
  const railLabel = isUR10e ? 'Rail (7th axis)' : 'AGV rail (7th axis)';
  const railRange = isUR10e ? { min: 0, max: 2.4 } : { min: -0.45, max: 3 };

  const handleJointChange = (index, value) => {
    setAngles((prev) => {
      const next = [...prev];
      next[index] = Number(value);
      return next;
    });
  };

  return (
    <div className="control-panel">
      <div className="robot-tabs">
        <button
          className={isUR10e ? 'active' : ''}
          onClick={() => setSelectedRobot('ur10e')}
        >
          UR10e
        </button>
        <button
          className={!isUR10e ? 'active' : ''}
          onClick={() => setSelectedRobot('kawasaki')}
        >
          Kawasaki
        </button>
      </div>

      <section className="control-section">
        <h3>Joints</h3>
        {angles.map((angle, index) => (
          <label className="joint-slider" key={JOINT_LABELS[index]}>
            <span className="joint-slider-label">
              {JOINT_LABELS[index]}
              <span className="joint-slider-value">{Math.round(angle)}°</span>
            </span>
            <input
              type="range"
              min={-360}
              max={360}
              step={1}
              value={angle}
              disabled={animate}
              onChange={(e) => handleJointChange(index, e.target.value)}
            />
          </label>
        ))}

        <label className="joint-slider">
          <span className="joint-slider-label">
            {railLabel}
            <span className="joint-slider-value">{railValue.toFixed(2)} m</span>
          </span>
          <input
            type="range"
            min={railRange.min}
            max={railRange.max}
            step={0.01}
            value={railValue}
            disabled={animate}
            onChange={(e) => setRailValue(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="control-section">
        <h3>Animation</h3>
        <label className="control-toggle">
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
          Play demo animation
        </label>
        <label className="joint-slider">
          <span className="joint-slider-label">
            Speed
            <span className="joint-slider-value">{animationSpeed.toFixed(1)}x</span>
          </span>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="control-section">
        <h3>Gripper</h3>
        <label className="joint-slider">
          <span className="joint-slider-label">
            Opening
            <span className="joint-slider-value">{Math.round(gripperOpen * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gripperOpen}
            onChange={(e) => setGripperOpen(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="control-section">
        <label className="control-toggle">
          <input
            type="checkbox"
            checked={showEnvironment}
            onChange={(e) => setShowEnvironment(e.target.checked)}
          />
          Show environment
        </label>
      </section>
    </div>
  );
}
