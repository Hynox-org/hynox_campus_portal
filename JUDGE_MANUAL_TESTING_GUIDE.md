# Hynox Campus — Judge Engine Manual Testing Guide

Use this guide to verify each language's compilation, runtime error extraction, and security checks on the Hynox Campus platform.

---

## 📋 Challenge Setup (Admin Console)

1. **Title:** `Sum of Two Numbers`
2. **Problem Description:** `Write a program that reads two space-separated integers from standard input and prints their sum.`
3. **Input Format:** `Two space-separated integers on a single line (e.g. "5 12")`
4. **Output Format:** `A single integer representing their sum (e.g. "17")`

### Add Test Cases
| Test Case Type | Input | Expected Output | Is Hidden |
| :--- | :--- | :--- | :---: |
| **Test Case 1 (Visible)** | `5 12` | `17` | `False` |
| **Test Case 2 (Hidden)** | `-3 8` | `5` | `True` |

---

## 💻 Code Snippets for Testing

### 1. Python 3
* **Accepted (Correct):**
  ```python
  import sys
  input_data = sys.stdin.read().strip()
  a, b = map(int, input_data.split())
  print(a + b)
  ```
* **Wrong Answer:**
  ```python
  print(999)
  ```
* **Runtime Error (Zero Division):**
  ```python
  print(1 / 0)
  ```
* **Security Violation:**
  ```python
  import os
  os.system("echo Hello")
  ```

### 2. Java (OpenJDK)
* **Accepted (Correct):**
  ```java
  import java.util.Scanner;
  public class Solution {
      public static void main(String[] args) {
          Scanner sc = new Scanner(System.in);
          if (sc.hasNextInt()) {
              int a = sc.nextInt();
              int b = sc.nextInt();
              System.out.println(a + b);
          }
      }
  }
  ```
* **Compile Error (Missing Semicolon):**
  ```java
  public class Solution {
      public static void main(String[] args) {
          System.out.println(42)
      }
  }
  ```
* **Security Violation:**
  ```java
  import java.io.File;
  public class Solution {
      public static void main(String[] args) {
          File file = new File("test.txt");
      }
  }
  ```

### 3. JavaScript / Node.js
* **Accepted (Correct):**
  ```javascript
  const fs = require('fs');
  const input = fs.readFileSync(0, 'utf-8').trim();
  const [a, b] = input.split(/\s+/).map(Number);
  console.log(a + b);
  ```
* **Security Violation:**
  ```javascript
  const child = require('child_process');
  child.execSync('dir');
  ```

### 4. TypeScript
* **Accepted (Correct):**
  ```typescript
  import * as fs from 'fs';
  const input: string = fs.readFileSync(0, 'utf-8').trim();
  const [a, b]: number[] = input.split(/\s+/).map(Number);
  console.log(a + b);
  ```

### 5. C (GCC)
* **Accepted (Correct):**
  ```c
  #include <stdio.h>
  int main() {
      int a, b;
      if (scanf("%d %d", &a, &b) == 2) {
          printf("%d", a + b);
      }
      return 0;
  }
  ```
* **Compile Error:**
  ```c
  #include <stdio.h>
  int main() {
      printf("Missing semicolon")
      return 0;
  }
  ```

### 6. C++ (G++)
* **Accepted (Correct):**
  ```cpp
  #include <iostream>
  using namespace std;
  int main() {
      int a, b;
      if (cin >> a >> b) {
          cout << (a + b);
      }
      return 0;
  }
  ```
