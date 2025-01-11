/*
 * SCServo.h
 * interface for waveshare serial bus servo
 */

#ifndef _SCSERVO_H
#define _SCSERVO_H

#include "SCS.h"
#include "STS.h"

#define ID_SHOULDER_MAIN_R 1
#define ID_SHOULDER_TILT_R 3
#define ID_ELBOW_ROTATE_R 5
#define ID_ELBOW_MAIN_R 7
#define ID_HIP_ROTATE_R 9
#define ID_HIP_TILT_R 11
#define ID_HIP_MAIN_R 13
#define ID_KNEE_R 15
#define ID_FOOT_MAIN_R 17
#define ID_FOOT_TILT_R 19

#define ID_SHOULDER_MAIN_L 2
#define ID_SHOULDER_TILT_L 4
#define ID_ELBOW_ROTATE_L 6
#define ID_ELBOW_MAIN_L 8
#define ID_HIP_ROTATE_L 10
#define ID_HIP_TILT_L 12
#define ID_HIP_MAIN_L 14
#define ID_KNEE_L 16
#define ID_FOOT_MAIN_L 18
#define ID_FOOT_TILT_L 20

#define ID_HEAD_HORIZONTAL 21
#define ID_HEAD_VERTICAL 22

extern const char* ServoNamesById[];

#endif