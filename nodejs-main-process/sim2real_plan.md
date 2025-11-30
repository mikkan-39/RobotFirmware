# Sim2Real Implementation Plan for RTv5 Humanoid

## Overview

This document describes how to deploy the trained Isaac Lab policy (`exported/policy.pt`) to the real RTv5 humanoid robot. The policy was trained using RSL-RL PPO on a velocity-tracking locomotion task.

---

## 1. Policy File

**Location:** `exported/policy.pt` (JIT-traced) or `exported/policy.onnx`

**Network Architecture (from training logs):**
```
Actor MLP:
  (0): Linear(in_features=54, out_features=512, bias=True)
  (1): ELU(alpha=1.0)
  (2): Linear(in_features=512, out_features=256, bias=True)
  (3): ELU(alpha=1.0)
  (4): Linear(in_features=256, out_features=128, bias=True)
  (5): ELU(alpha=1.0)
  (6): Linear(in_features=128, out_features=14, bias=True)
```

- **Input:** 54 floats (observation vector)
- **Output:** 14 floats (joint position deltas, clipped to [-1, 1])

---

## 2. Control Frequency

**Simulation dt:** 0.02s (50 Hz)  
**Decimation:** 1  
**Required real-world loop rate:** **50 Hz**

The firmware must run inference and send servo commands at this rate. Faster is acceptable if you interpolate; slower will cause timing mismatch.

---

## 3. Observation Vector (54 floats)

Observations are concatenated in this exact order:

| Index | Name | Size | Description | Real Sensor |
|-------|------|------|-------------|-------------|
| 0-2 | `base_lin_acc` | 3 | Linear acceleration in body frame (m/s²) | IMU accelerometer |
| 3-5 | `base_ang_vel` | 3 | Angular velocity in body frame (rad/s) | IMU gyroscope |
| 6-8 | `projected_gravity` | 3 | Gravity vector projected into body frame | Computed from IMU orientation |
| 9-11 | `velocity_commands` | 3 | [vx, vy, wz] velocity command | User input / joystick |
| 12-25 | `joint_pos` | 14 | Joint positions relative to default (rad) | Servo encoders |
| 26-39 | `joint_vel` | 14 | Joint velocities (rad/s) | Servo velocity or differentiation |
| 40-53 | `actions` | 14 | Previous action sent to policy | Your action buffer |

**Total: 3 + 3 + 3 + 3 + 14 + 14 + 14 = 54**

### 3.1 Projected Gravity Calculation

From IMU quaternion `[qw, qx, qy, qz]` (scalar-first):
```python
def projected_gravity(qw, qx, qy, qz):
    # Rotate world gravity [0, 0, -1] into body frame
    gx = 2 * (qx*qz - qw*qy)
    gy = 2 * (qy*qz + qw*qx)
    gz = 1 - 2*(qx**2 + qy**2)
    return [gx, gy, -gz]  # Returns unit vector pointing opposite to gravity
```

### 3.2 Joint Position Relative

```python
joint_pos_rel = current_joint_pos - DEFAULT_JOINT_POS
```

All 14 controllable joints have `DEFAULT_JOINT_POS = 0.0` (URDF default).

---

## 4. Controllable Joints (14 joints)

The policy controls joints matching regex: `^(?!.*(Neck|to_Elbow|to_Arm|to_ShoulderR|to_ShoulderL)).*$`

**Excluded joints (8 total):**
- `base_link_to_Neck_revolute` (Neck)
- `Neck_to_Head_revolute` (Neck)
- `shoulder_joint_v1Mirror_to_ShoulderL_revolute` (to_ShoulderL)
- `shoulder_joint_v1_to_ShoulderR_revolute` (to_ShoulderR)
- `ShoulderL_to_ElbowL_revolute` (to_Elbow)
- `ShoulderR_to_ElbowR_revolute` (to_Elbow)
- `ElbowL_to_ArmL_revolute` (to_Arm)
- `ElbowR_to_ArmR_revolute` (to_Arm)

**Included joints (14 total, in URDF traversal order with `preserve_order=True`):**

| Index | Joint Name | URDF Limits (rad) |
|-------|------------|-------------------|
| 0 | `base_link_to_shoulder_joint_v1_revolute` | [-1.57, 3.14] |
| 1 | `base_link_to_shoulder_joint_v1Mirror_revolute` | [-3.14, 1.57] |
| 2 | `base_link_to_RightHipBracket_revolute` | [-0.61, 0.61] |
| 3 | `base_link_to_LeftHipBracket_revolute` | [-0.61, 0.61] |
| 4 | `LeftHipBracket_to_HipBulkL_revolute` | [-0.44, 0.44] |
| 5 | `RightHipBracket_to_HipBulkR_revolute` | [-0.44, 0.44] |
| 6 | `HipBulkL_to_HipL_revolute` | [-1.57, 0.79] |
| 7 | `HipBulkR_to_HipR_revolute` | [-0.61, 1.57] |
| 8 | `HipL_to_TibiaL_revolute` | [0.0, 1.92] |
| 9 | `HipR_to_TibiaR_revolute` | [-1.92, 0.0] |
| 10 | `TibiaR_to_FootJointR_revolute` | [-1.48, 0.79] |
| 11 | `TibiaL_to_FootJointL_revolute` | [-1.48, 0.79] |
| 12 | `FootJointL_to_LeftFoot_revolute` | [-0.35, 0.35] |
| 13 | `FootJointR_to_RightFoot_revolute` | [-0.35, 0.35] |

**CRITICAL:** Verify the exact joint order by printing joint names from Isaac Sim or checking your servo ID mapping. The order above is based on URDF structure but actual ordering depends on articulation parsing.

## 4.1 Joint Direction Analysis (URDF)

Each joint's positive rotation direction depends on its axis and the parent frame orientation:

| Idx | Joint Name | Axis | Origin RPY | Limits (deg) | Positive Direction |
|-----|------------|------|------------|--------------|-------------------|
| 0 | `base_link_to_shoulder_joint_v1_revolute` | Z | (0, -90°, 0) | [-90°, 180°] | Right arm swings forward |
| 1 | `base_link_to_shoulder_joint_v1Mirror_revolute` | Z | (180°, -90°, 0) | [-180°, 90°] | Left arm swings backward |
| 2 | `base_link_to_RightHipBracket_revolute` | Z | (-180°, 0, 0) | [-35°, 35°] | Right toe rotates outward |
| 3 | `base_link_to_LeftHipBracket_revolute` | Z | (-180°, 0, 0) | [-35°, 35°] | Left toe rotates outward |
| 4 | `LeftHipBracket_to_HipBulkL_revolute` | Z | (+90°, 0, 0) | [-25°, 25°] | Left leg abducts outward |
| 5 | `RightHipBracket_to_HipBulkR_revolute` | Z | (-90°, 0, 0) | [-25°, 25°] | Right leg adducts inward |
| 6 | `HipBulkL_to_HipL_revolute` | Z | (-90°, 0, -90°) | [-90°, 45°] | Left thigh moves backward |
| 7 | `HipBulkR_to_HipR_revolute` | Z | (-90°, 0, +90°) | [-35°, 90°] | Right thigh moves forward |
| 8 | `HipL_to_TibiaL_revolute` | Z | (0, 0, 0) | [0°, 110°] | Left knee bends (flexion) |
| 9 | `HipR_to_TibiaR_revolute` | Z | (0, 0, 0) | [-110°, 0°] | Right knee extends (negative = bend) |
| 10 | `TibiaR_to_FootJointR_revolute` | Z | (-180°, 0, 0) | [-85°, 45°] | Right toe points up |
| 11 | `TibiaL_to_FootJointL_revolute` | Z | (0, 0, 0) | [-85°, 45°] | Left toe points down |
| 12 | `FootJointL_to_LeftFoot_revolute` | Z | (+90°, -90°, 0) | [-20°, 20°] | Left foot rolls |
| 13 | `FootJointR_to_RightFoot_revolute` | Z | (-90°, -90°, 0) | [-20°, 20°] | Right foot rolls |

---

## 4.2 Critical Left/Right Asymmetries

**WARNING:** The URDF uses opposite sign conventions for left vs right legs:

| Joint Type | Left Leg | Right Leg | Notes |
|------------|----------|-----------|-------|
| **Hip roll** | +pos = abduct (out) | +pos = adduct (in) | **OPPOSITE** |
| **Hip pitch** | -neg = forward | +pos = forward | **OPPOSITE** |
| **Knee** | +pos = bend [0, 1.92] | -neg = bend [-1.92, 0] | **OPPOSITE** |
| **Ankle pitch** | +pos = toe down | +pos = toe up | **OPPOSITE** |

This means if you send the same positive value to both legs, they will move in opposite directions!

---

## 4.3 Joint Verification Test Sequence

Run each joint individually to verify sign convention matches your servos:

# Test one joint at a time, all others at 0
# Expected motion assumes robot facing +X, +Y is left, +Z is up

verification_tests = [
    # (index, test_value, expected_motion)
    (0,   0.5,  "Right arm rotates forward ~30°"),
    (1,  -0.5,  "Left arm rotates forward ~30°"),   # NEGATIVE for forward
    (2,   0.3,  "Right hip yaw: toe out ~17°"),
    (3,   0.3,  "Left hip yaw: toe out ~17°"),
    (4,   0.2,  "Left leg abducts outward ~11°"),
    (5,  -0.2,  "Right leg abducts outward ~11°"),  # NEGATIVE for same motion
    (6,  -0.5,  "Left thigh moves forward ~30°"),   # NEGATIVE for forward
    (7,   0.5,  "Right thigh moves forward ~30°"),
    (8,   0.5,  "Left knee bends ~30°"),
    (9,  -0.5,  "Right knee bends ~30°"),           # NEGATIVE for same motion
    (10,  0.3,  "Right ankle: toe up ~17°"),
    (11, -0.3,  "Left ankle: toe up ~17°"),         # NEGATIVE for same motion
    (12,  0.2,  "Left foot rolls ~11°"),
    (13,  0.2,  "Right foot rolls ~11°"),
]
---

## 4.4 Quick Diagnostic

If the robot went crazy immediately:

1. Knee test: Command joint 8 to +0.5 and joint 9 to -0.5
   - Both knees should bend the same direction
   - If one extends while other bends → sign mismatch

2. Hip pitch test: Command joint 6 to -0.5 and joint 7 to +0.5
   - Both thighs should move forward
   - If one goes forward and one goes back → sign mismatch

3. Standing pose: All joints at 0.0 should produce a neutral stance
   - If robot collapses → check knee signs (8, 9) first

---

## 5. Action Space

**Type:** Joint position targets  
**Range:** Policy outputs in [-1, 1], clipped  
**Scale:** 1.0  
**Offset:** Default joint position (0.0 for all controllable joints)

**Conversion to servo command:**
```python
# Policy output: action[i] in [-1, 1]
target_position[i] = DEFAULT_JOINT_POS[i] + action[i] * 1.0
```

---

## 6. Actuator Model (Sim)

The simulation used `ImplicitActuator` (PD controller):
- **Stiffness (Kp):** 12.0 (randomized 8.0-16.0 during training)
- **Damping (Kd):** 2.5 (randomized 1.5-3.5 during training)
- **Effort limit:** 2.0 Nm
- **Velocity limit:** 5.0 rad/s

Your ST3215 servos have their own internal PD controller. Options:
1. **Position mode:** Send position targets directly. Servo's internal PD handles tracking.
2. **Torque mode:** Implement PD externally: `torque = Kp * (target - current) + Kd * (0 - velocity)`

---

## 7. Reference Implementation

```python
import torch
import numpy as np

class PolicyRunner:
    def __init__(self, policy_path: str):
        self.policy = torch.jit.load(policy_path)
        self.policy.eval()
        
        # 14 controllable joints, all default to 0.0
        self.num_joints = 14
        self.default_pos = np.zeros(self.num_joints, dtype=np.float32)
        self.last_action = np.zeros(self.num_joints, dtype=np.float32)
        
    def compute_projected_gravity(self, quat: np.ndarray) -> np.ndarray:
        """quat: [qw, qx, qy, qz] scalar-first"""
        qw, qx, qy, qz = quat
        gx = 2 * (qx*qz - qw*qy)
        gy = 2 * (qy*qz + qw*qx)
        gz = 1 - 2*(qx**2 + qy**2)
        return np.array([gx, gy, -gz], dtype=np.float32)
    
    def build_observation(
        self,
        imu_accel: np.ndarray,      # [3] m/s² body frame
        imu_gyro: np.ndarray,       # [3] rad/s body frame
        imu_quat: np.ndarray,       # [4] [qw,qx,qy,qz]
        cmd_vel: np.ndarray,        # [3] [vx, vy, wz]
        joint_pos: np.ndarray,      # [14] radians
        joint_vel: np.ndarray,      # [14] rad/s
    ) -> np.ndarray:
        
        proj_grav = self.compute_projected_gravity(imu_quat)
        joint_pos_rel = joint_pos - self.default_pos
        
        obs = np.concatenate([
            imu_accel,          # 3
            imu_gyro,           # 3
            proj_grav,          # 3
            cmd_vel,            # 3
            joint_pos_rel,      # 14
            joint_vel,          # 14
            self.last_action,   # 14
        ]).astype(np.float32)
        
        assert obs.shape == (54,), f"Expected 54, got {obs.shape}"
        return obs
    
    def step(self, obs: np.ndarray) -> np.ndarray:
        """Returns target joint positions (14,)"""
        obs_tensor = torch.from_numpy(obs).unsqueeze(0)
        
        with torch.no_grad():
            action = self.policy(obs_tensor).squeeze().numpy()
        
        # Clip to training range
        action = np.clip(action, -1.0, 1.0)
        self.last_action = action.copy()
        
        # Convert to absolute position
        target_pos = self.default_pos + action * 1.0
        return target_pos

# Main loop (50 Hz)
runner = PolicyRunner("exported/policy.pt")
cmd_vel = np.array([0.5, 0.0, 0.0], dtype=np.float32)  # Forward at 0.5 m/s

while True:
    # Read sensors
    imu_accel = read_imu_accelerometer()  # [ax, ay, az]
    imu_gyro = read_imu_gyroscope()       # [wx, wy, wz]
    imu_quat = read_imu_quaternion()      # [qw, qx, qy, qz]
    joint_pos = read_servo_positions()    # [14]
    joint_vel = read_servo_velocities()   # [14]
    
    # Build observation and run policy
    obs = runner.build_observation(
        imu_accel, imu_gyro, imu_quat, cmd_vel, joint_pos, joint_vel
    )
    target_pos = runner.step(obs)
    
    # Send to servos
    send_servo_positions(target_pos)
    
    # Wait for next cycle (50 Hz)
    sleep_until_next_cycle()
```

---

## 8. Sim2Real Gap Checklist

| Issue | Sim Behavior | Real-World Fix |
|-------|--------------|----------------|
| **Acceleration observation** | Computed from velocity diff | Use IMU accelerometer directly (may need calibration) |
| **Joint velocity** | Direct from physics | Differentiate encoder or use servo feedback |
| **Control latency** | ~0ms | Account for communication delay |
| **Servo dynamics** | Ideal PD | ST3215 has internal PD; may need gain tuning |
| **Noise** | Uniform ±0.1 on accel, ±0.05 on gyro | Real sensor noise differs |
| **Gravity direction** | Perfect IMU | Calibrate accelerometer bias |

---

## 9. Velocity Command Range

Training used:
- `lin_vel_x`: [0.0, 1.0] m/s (some runs fixed at 1.0)
- `lin_vel_y`: [0.0, 0.0] m/s (no lateral movement)
- `ang_vel_z`: [-1.0, 1.0] rad/s (turning)

Stay within these ranges initially. The policy may behave unpredictably outside training distribution.

---

## 10. Safety Recommendations

1. **Start with robot suspended** — verify joint motion before ground contact
2. **Use low velocity commands first** — [0.1, 0, 0]
3. **Monitor joint limits** — clamp outputs to URDF limits
4. **Add emergency stop** — detect excessive tilt (>1 rad from vertical)
5. **Log everything** — observations, actions, timestamps for debugging

---

## 11. Files Reference

| File | Purpose |
|------|---------|
| `exported/policy.pt` | JIT-traced inference model |
| `exported/policy.onnx` | ONNX format for embedded deployment |
| `params/env.yaml` | Full environment configuration |
| `params/agent.yaml` | Training hyperparameters |
| `Robot_cleanv2.urdf` | Robot kinematic/dynamic model |

---

## 12. Debugging Tips

1. **Print observation vector** in sim and real — they should have similar magnitudes
2. **Zero command test** — with cmd_vel=[0,0,0], robot should stand still
3. **Joint order mismatch** — most common bug; verify by commanding one joint at a time
4. **Sign conventions** — check if your IMU/encoders match sim coordinate frames
5. **Quaternion convention** — Isaac uses scalar-first [w,x,y,z]; some IMUs use scalar-last

---

## 13. Joint-to-Servo Mapping Template

Fill this in based on your hardware:

| Policy Index | Joint Name | Servo ID | Sign Flip? |
|--------------|------------|----------|------------|
| 0 | base_link_to_shoulder_joint_v1_revolute | ? | ? |
| 1 | base_link_to_shoulder_joint_v1Mirror_revolute | ? | ? |
| 2 | base_link_to_RightHipBracket_revolute | ? | ? |
| 3 | base_link_to_LeftHipBracket_revolute | ? | ? |
| 4 | LeftHipBracket_to_HipBulkL_revolute | ? | ? |
| 5 | RightHipBracket_to_HipBulkR_revolute | ? | ? |
| 6 | HipBulkL_to_HipL_revolute | ? | ? |
| 7 | HipBulkR_to_HipR_revolute | ? | ? |
| 8 | HipL_to_TibiaL_revolute | ? | ? |
| 9 | HipR_to_TibiaR_revolute | ? | ? |
| 10 | TibiaR_to_FootJointR_revolute | ? | ? |
| 11 | TibiaL_to_FootJointL_revolute | ? | ? |
| 12 | FootJointL_to_LeftFoot_revolute | ? | ? |
| 13 | FootJointR_to_RightFoot_revolute | ? | ? |

---

*Generated from Isaac Lab training run: RTv5_rough/2025-11-30_14-16-37*
